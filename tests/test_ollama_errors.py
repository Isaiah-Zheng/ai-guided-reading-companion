import unittest
import urllib.error
from unittest.mock import patch
from test_backend import server

class OllamaDiagnosticsTests(unittest.TestCase):
    def test_closed_service_is_not_reported_as_missing_model(self):
        with patch.dict('os.environ',{'AI_PROVIDER':'ollama'}), patch.object(server,'local_request',side_effect=urllib.error.URLError(ConnectionRefusedError())):
            with self.assertRaisesRegex(server.BackendError,'Ollama is not running'):
                server.ask_model('system',{})
            self.assertFalse(server.health_status()['ollama_running'])
    def test_missing_model_is_distinct(self):
        error=urllib.error.HTTPError('http://localhost',404,'missing',{},None)
        with patch.dict('os.environ',{'AI_PROVIDER':'ollama'}), patch.object(server,'local_request',side_effect=[{'models':[]},error]):
            with self.assertRaisesRegex(server.BackendError,'selected model is missing'):
                server.ask_model('system',{})
    def test_bad_json_is_not_reported_as_connection_failure(self):
        with patch.dict('os.environ',{'AI_PROVIDER':'ollama'}), patch.object(server,'local_request',side_effect=[{'models':[]},{'done':True,'message':{'content':'bad'}}]):
            with self.assertRaisesRegex(server.BackendError,'invalid answer'):
                server.ask_model('system',{})
