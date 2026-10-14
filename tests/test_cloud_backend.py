import json
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from backend.app import Guide, GuideRequest, create_app

ORIGIN = 'chrome-extension://' + 'a' * 32
PASSAGE = 'Caesar crossed the Rubicon with resolve.'
B = {'en': 'Contextual help', 'zh': '语境解释'}
FIXTURE = {
    'vocabulary': [{'term': 'resolve', 'quote': PASSAGE, 'priority': 'A', 'register': 'formal',
                    'cefr_estimate': 'B2', 'meaning': B, 'usage': B, 'learning_advice': B}],
    'context': [{'name': 'Rubicon', 'chinese_name': '卢比孔河', 'kind': 'place',
                 'explanation': B, 'evidence': 'general_background'}],
    'sentences': [{'quote': PASSAGE, 'explanation': B}],
}

class BackendTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app('a' * 32))

    def post(self, **changes):
        return self.client.post('/guide', headers={'Origin': ORIGIN}, json={'text': PASSAGE, **changes})

    def provider(self, body, status=200):
        response = httpx.Response(status, json=body)
        return patch('backend.app.httpx.AsyncClient.post', return_value=response)

    def result(self, guide=FIXTURE):
        return {'status': 'completed', 'output': [{'type': 'message', 'content': [
            {'type': 'output_text', 'text': json.dumps(guide)}]}]}

    def test_reject_web_and_missing_origins(self):
        for headers in ({}, {'Origin': 'https://evil.example'}):
            self.assertEqual(self.client.post('/guide', headers=headers, json={'text': PASSAGE}).status_code, 403)

    def test_cors(self):
        response = self.client.options('/guide', headers={'Origin': ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
        self.assertEqual(response.headers['access-control-allow-origin'], ORIGIN)
        self.assertNotIn('access-control-allow-origin', self.client.options('/guide', headers={'Origin': 'https://evil.example', 'Access-Control-Request-Method': 'POST'}).headers)

    def test_validation(self):
        for data in ({'text': '  '}, {'text': 'x' * 12001}, {'mode': 'Extreme'}, {'known_words': ['x' * 101]}):
            self.assertEqual(self.post(**data).status_code, 422)

    @patch.dict('os.environ', {'OPENAI_API_KEY': ''})
    def test_missing_key(self):
        self.assertEqual(self.post().status_code, 503)

    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-placeholder'})
    def test_structured_request_and_opt_in(self):
        with self.provider(self.result()) as provider:
            response = self.post(sentence_help=True)
            self.assertEqual(response.status_code, 200)
            Guide.model_validate(response.json())
            self.assertEqual(len(response.json()['sentences']), 1)
            payload = provider.call_args.kwargs['json']
            self.assertFalse(payload['store'])
            self.assertTrue(payload['text']['format']['strict'])
            self.assertNotIn('test-placeholder', json.dumps(payload))
            self.assertEqual(self.post().json()['sentences'], [])
            self.assertEqual(self.post(known_words=['RESOLVE']).json()['vocabulary'], [])

    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-placeholder'})
    def test_invented_quotes_filtered(self):
        fixture = json.loads(json.dumps(FIXTURE))
        fixture['vocabulary'][0]['quote'] = 'Invented'
        fixture['sentences'][0]['quote'] = 'Invented'
        fixture['context'][0]['name'] = 'Invented'
        with self.provider(self.result(fixture)):
            self.assertEqual(self.post(sentence_help=True).json(), {'vocabulary': [], 'context': [], 'sentences': []})

    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-placeholder'})
    def test_provider_failures(self):
        cases = [(429, {}, 429), (401, {}, 502), (200, {'status': 'incomplete'}, 502),
                 (200, {'status': 'completed', 'output': []}, 502),
                 (200, {'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'refusal'}]}]}, 422)]
        for status, body, expected in cases:
            with self.provider(body, status):
                self.assertEqual(self.post().status_code, expected)
        with patch('backend.app.httpx.AsyncClient.post', side_effect=httpx.ReadTimeout('timeout')):
            self.assertEqual(self.post().status_code, 504)

    def test_mode_caps(self):
        from backend.app import enforce_guide
        fixture = json.loads(json.dumps(FIXTURE))
        fixture['vocabulary'] *= 15
        fixture['context'] *= 10
        fixture['sentences'] *= 8
        for mode, counts in [('Light', (3, 2, 1)), ('Balanced', (6, 4, 2)), ('Deep', (10, 6, 4))]:
            guide = enforce_guide(Guide.model_validate(fixture), GuideRequest(text=PASSAGE, mode=mode, sentence_help=True))
            self.assertEqual((len(guide.vocabulary), len(guide.context), len(guide.sentences)), counts)

    def test_strict_schema_requires_every_property(self):
        schema = Guide.model_json_schema()
        def check(node):
            if isinstance(node, dict):
                if node.get('type') == 'object':
                    self.assertFalse(node['additionalProperties'])
                    self.assertEqual(set(node['properties']), set(node['required']))
                for value in node.values():
                    check(value)
            elif isinstance(node, list):
                for value in node:
                    check(value)
        check(schema)

if __name__ == '__main__':
    unittest.main()
