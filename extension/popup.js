const saved=await chrome.storage.local.get('settings');document.getElementById('model').value=saved.settings?.model||'qwen3.5:4b';
document.getElementById('model').onchange=async e=>{await chrome.storage.local.set({settings:{...saved.settings,model:e.target.value}});};
async function action(type){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const result=await chrome.runtime.sendMessage({type,tabId:tab?.id});if(result?.error)document.getElementById('status').textContent=result.error;else window.close();}
document.getElementById('web').onclick=()=>action('toggle-web');document.getElementById('library').onclick=()=>action('library');document.getElementById('import').onclick=()=>action('import-web');
