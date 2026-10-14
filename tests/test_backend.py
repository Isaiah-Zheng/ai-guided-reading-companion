import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('backend',Path(__file__).parents[1]/'backend/server.py')
server=importlib.util.module_from_spec(spec);spec.loader.exec_module(server)

class BackendTests(unittest.TestCase):
    def test_utf16_and_exact_spans(self):
        text='😀 reluctant, reluctant.'
        items=[{'word':'reluctant','lemma':'reluctant','zh':'不情愿','kind':'learn','occurrence':1},
               {'word':'invented','lemma':'invent','zh':'错误','kind':'learn'}]
        result=server.clean_annotations(text,items)
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]['start'],14)
        self.assertEqual(result[0]['end'],23)
    def test_batch_validation(self):
        for payload in ({'paragraphs':[]},{'paragraphs':[{'index':0,'text':'x'*6001}]},{'paragraphs':[{'index':0,'text':'a'},{'index':0,'text':'b'}]}):
            with self.assertRaises(ValueError): server.analyze(payload)
    def test_provider_output_is_anchored_to_original(self):
        with patch.object(server,'cached_call',return_value={'paragraphs':[{'index':3,'annotations':[{'word':'reluctant','lemma':'reluctant','kind':'learn','zh':'不情愿'}]}]}):
            result=server.analyze({'paragraphs':[{'index':3,'text':'A reluctant reader.'}]})
        self.assertEqual(result['paragraphs'][0]['annotations'][0]['start'],2)
    def test_context_cache_reuses_requests(self):
        server.CACHE.clear()
        with patch.object(server,'ask_model',return_value={'ok':True}) as model:
            server.cached_call('system',{'text':'same'});server.cached_call('system',{'text':'same'})
            self.assertEqual(model.call_count,1)

if __name__=='__main__': unittest.main()
