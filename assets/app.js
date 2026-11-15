const features = [
 ['⌁','配对与连接','Pairing & connection','一键重连、扫码配对、深链粘贴即连，多主机切换与断线自动重连。','Reconnect in one tap, pair by QR or shared link, switch hosts, and recover from drops automatically.'],
 ['▦','任务与工作区','Tasks & workspaces','任务列表、搜索筛选、多选批量操作，以及归档与置顶。','Browse, search and filter tasks; select in bulk, archive or pin.'],
 ['◈','会话指挥','Session control','流式消息、审批卡片、用户提问、计划模式与消息分支。','Streaming messages, approval cards, user questions, plan mode and message branches.'],
 ['◷','计划任务','Scheduled tasks','查看 Host 或 Agent 创建的定时任务、启用或停用并查看历史。','View schedules created by the Host or agents, enable or disable them, and inspect history.'],
 ['▤','文件与变更','Files & changes','浏览会话文件树、预览 Markdown / JSON，查看工作区 diff。','Browse session files, preview Markdown and JSON, and inspect workspace diffs.'],
 ['◇','插件与模型','Plugins & models','管理提供方、模型、插件与 bundle，以及标准、PCT、极简、创造模式预设。','Manage providers, models, plugins and bundles, plus Standard, PCT, Minimal and Creative agent presets.'],
 ['>_','终端与诊断','Terminal & diagnostics','交互式终端、Jobs 与子代理，以及用量和上下文信息。','Use an interactive terminal and inspect jobs, subagents, usage and context.'],
 ['◐','外观与体验','Look & feel','浅色、深色与系统主题，字号规范与中英双语。','Light, dark and system themes, consistent typography, and Chinese and English.']
];
const screens = [
 ['tasks-demo.png','任务列表','Task list'],['session-demo.png','会话与消息','Sessions & messages'],['session-running-demo.png','运行中的会话','Running session'],['settings-demo.png','设置与连接','Settings & connection']
];
const plugins = [
 ['dsh-plugin-mobile-pair','手机配对二维码','Mobile pairing QR','装一次，`dsh web` 启动时就在终端打印配对二维码；手机点「扫码配对」直接连，不用再输入地址和 token。','Install once and `dsh web` prints a pairing QR at startup; tap “Scan to pair” on the phone and connect without typing a URL or token.','dsh plugin --profile web add dsh-plugin-mobile-pair','https://coolwolfqs.github.io/dsh-mobile-site/market/index.json']
];
const faqs = [
 ['需要什么 Host？','What Host do I need?','需要自行准备可从手机访问的 DSH Host 0.2.1 或更高版本。应用本身不包含 Host。','You need your own DSH Host 0.2.1 or later, reachable from your phone. The app does not include a Host.'],
 ['数据是否经过第三方服务器？','Does data pass through a third-party server?','应用用于连接你自己的 DSH Host；实际网络路径取决于你配置的 Host 地址、网络和代理。请检查自己的部署配置。','The app connects to your own DSH Host. The actual network path depends on your Host address, network and proxy configuration; check your deployment.'],
 ['为什么没有上架商店？','Why is it not in an app store?','目前通过 GitHub Releases 直接分发 APK，未通过 Google Play 分发。','The APK is currently distributed directly through GitHub Releases, not Google Play.'],
 ['支持 iOS 或鸿蒙吗？','Is iOS or HarmonyOS supported?','Android 已发布；iOS 与 HarmonyOS（鸿蒙）正在开发中，完成后会在此页面与 Releases 公布。','Android is available. iOS and HarmonyOS are in development; releases will be announced here and on Releases.'],
 ['如何更新版本？','How do I update?','访问 Releases 页面，下载新版本 APK 并按设备提示安装。','Visit the Releases page, download the newer APK and follow your device’s installation prompts.']
];
const grid=document.querySelector('#feature-grid');
features.forEach(([icon,zh,en,descZh,descEn],i)=>{const el=document.createElement('article');el.className='feature-card';el.innerHTML=`<div class="feature-top"><span class="feature-icon"><svg viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="12"/><text x="20" y="26" text-anchor="middle">${icon}</text></svg></span><span class="feature-number">0${i+1}</span></div><h3 data-zh="${zh}" data-en="${en}">${zh}</h3><p data-zh="${descZh}" data-en="${descEn}">${descZh}</p>`;grid.append(el)});
const gallery=document.querySelector('#gallery');screens.forEach(([file,zh,en],i)=>{const el=document.createElement('button');el.className='screen-card';el.type='button';el.dataset.zhLabel=zh;el.dataset.enLabel=en;el.innerHTML=`<div class="screen-image"><img src="assets/screens/${file}" width="1082" height="2402" loading="lazy" alt="${zh}"><span class="zoom" aria-hidden="true">↗</span></div><div class="screen-caption"><span>0${i+1} / <b data-zh="${zh}" data-en="${en}">${zh}</b></span><span>↗</span></div>`;gallery.append(el)});
const pluginGrid=document.querySelector('#plugin-grid');
if(pluginGrid)plugins.forEach(([name,zh,en,descZh,descEn,install,index],i)=>{
  const el=document.createElement('article');el.className='plugin-card';
  el.innerHTML=`<div class="plugin-head"><h3 data-zh="${zh}" data-en="${en}">${zh}</h3><code class="plugin-name">${name}</code></div><p data-zh="${descZh}" data-en="${descEn}">${descZh}</p><div class="plugin-install"><code>${install.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</code><button type="button" class="plugin-copy" data-code="${install.replace(/"/g,'&quot;')}" data-zh="复制" data-en="Copy">复制</button></div><div class="plugin-links"><a href="https://coolwolfqs.github.io/dsh-mobile-site/plugins/${name}/README.md" data-zh="插件文档 ↗" data-en="Plugin docs ↗">插件文档 ↗</a><a href="${index}" data-zh="插件索引 ↗" data-en="Plugin index ↗">插件索引 ↗</a></div>`;
  pluginGrid.append(el);
});
document.querySelectorAll('.plugin-copy').forEach(button=>button.addEventListener('click',async()=>{
  const code=button.dataset.code;
  try{await navigator.clipboard.writeText(code)}catch{const area=document.createElement('textarea');area.value=code;document.body.append(area);area.select();document.execCommand('copy');area.remove()}
  const original=button.dataset[lang]??'';
  button.textContent=lang==='zh'?'已复制':'Copied';
  setTimeout(()=>{button.textContent=original},1500);
}));
const faq=document.querySelector('#faq-list');faqs.forEach(([qz,qe,az,ae])=>{let el=document.createElement('details');el.innerHTML=`<summary><span data-zh="${qz}" data-en="${qe}">${qz}</span><span class="plus" aria-hidden="true">+</span></summary><p data-zh="${az}" data-en="${ae}">${az}</p>`;faq.append(el)});
let lang=localStorage.getItem('dsh-language')==='en'?'en':'zh';const language=document.querySelector('#language');function setLanguage(){document.documentElement.lang=lang==='zh'?'zh-CN':'en';document.querySelectorAll('[data-zh][data-en]').forEach(el=>el.innerHTML=el.dataset[lang]);language.textContent=lang==='zh'?'EN':'中文';language.setAttribute('aria-label',lang==='zh'?'Switch to English':'切换为中文');document.querySelectorAll('.screen-card').forEach(el=>{const label=el.dataset[lang+'Label'];el.setAttribute('aria-label',(lang==='zh'?'放大截图：':'Enlarge screenshot: ')+label);el.querySelector('img').alt=label});document.querySelector('#theme').setAttribute('aria-label',lang==='zh'?'切换主题':'Change theme');document.querySelector('#menu').setAttribute('aria-label',lang==='zh'?'切换导航':'Toggle navigation');document.querySelector('#close-lightbox').setAttribute('aria-label',lang==='zh'?'关闭截图':'Close screenshot');document.querySelector('#lightbox').setAttribute('aria-label',lang==='zh'?'截图放大':'Enlarged screenshot')};language.addEventListener('click',()=>{lang=lang==='zh'?'en':'zh';localStorage.setItem('dsh-language',lang);setLanguage()});setLanguage();
const theme=document.querySelector('#theme');let mode=localStorage.getItem('dsh-theme')||'system';function applyTheme(){document.documentElement.dataset.theme=mode;theme.title=mode==='system'?'System':mode==='dark'?'Dark':'Light';theme.querySelector('span').textContent=mode==='system'?'◐':mode==='dark'?'☾':'☼'}theme.addEventListener('click',()=>{mode=mode==='system'?'light':mode==='light'?'dark':'system';localStorage.setItem('dsh-theme',mode);applyTheme()});applyTheme();
const menu=document.querySelector('#menu'),nav=document.querySelector('#nav-links');menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open)});nav.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');menu.setAttribute('aria-expanded','false')}});
const lightbox=document.querySelector('#lightbox'),lightboxImage=document.querySelector('#lightbox-image'),caption=document.querySelector('#lightbox-caption');gallery.addEventListener('click',e=>{const card=e.target.closest('.screen-card');if(!card)return;const img=card.querySelector('img');lightboxImage.src=img.src;lightboxImage.alt=img.alt;caption.textContent=img.alt;lightbox.showModal()});document.querySelector('#close-lightbox').addEventListener('click',()=>lightbox.close());lightbox.addEventListener('click',e=>{if(e.target===lightbox)lightbox.close()});
