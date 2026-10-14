import json
import unittest
from unittest.mock import patch
from test_backend import server

class LocalTests(unittest.TestCase):
    def setUp(self):
        server.CACHE.clear()
        env = patch.dict('os.environ', {'AI_PROVIDER':'ollama', 'OLLAMA_MODEL':'qwen3.5:4b', 'OPENAI_API_KEY':''})
        env.start(); self.addCleanup(env.stop)

    def test_local_switch_and_no_cloud_key(self):
        with patch.object(server, 'local_request', side_effect=[
            {'models':[{'name':'qwen3.5:4b'}]}, {'done':True},
            {'done':True,'done_reason':'stop','message':{'content':'{"paragraphs":[]}'}}
        ]) as api:
            self.assertEqual(server.ask_model('system', {'text':'sample'}, 'qwen3.5:9b'), {'paragraphs':[]})
            self.assertEqual(api.call_args_list[1].args, ('/api/generate', {'model':'qwen3.5:4b','keep_alive':0}))
            payload=api.call_args_list[2].args[1]
            self.assertEqual(payload['model'],'qwen3.5:9b')
            self.assertFalse(payload['think']); self.assertFalse(payload['stream'])

    def test_cache_separates_models(self):
        with patch.object(server,'ask_model',return_value={'ok':True}) as model:
            for name in ('qwen3.5:4b','qwen3.5:9b','qwen3.5:4b'):
                server.cached_call('system',{'text':'same'},name)
            self.assertEqual(model.call_count,2)

    def test_reject_unknown_model_and_incomplete_output(self):
        with self.assertRaises(ValueError): server.selected_model({'model':'unknown'})
        with patch.object(server,'local_request',side_effect=[{'models':[]},{'done':True,'done_reason':'length'}]):
            with self.assertRaises(server.BackendError): server.ask_model('system',{})
