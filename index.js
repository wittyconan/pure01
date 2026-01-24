const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const { execSync } = require('child_process');

// ==============================================================================
// 环境变量配置区 
// ==============================================================================
const UPLOAD_URL = process.env.UPLOAD_URL || '';      
const PROJECT_URL = process.env.PROJECT_URL || '';    
const AUTO_ACCESS = process.env.AUTO_ACCESS || false; 
const FILE_PATH = process.env.FILE_PATH || './tmp';   
const SUB_PATH = process.env.SUB_PATH || 'sub';       
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000; 

// --- 核心配置 ---
const UUID = process.env.UUID || '646e21d6-9660-4a67-bbca-230de4acbce0'; 
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || 'p4.yyvpn.qzz.io';         
const ARGO_AUTH = process.env.ARGO_AUTH || 'eyJhIjoiYzE1MjZjNzg5Mjc3N2QwMDQzMTNhYmIyODIyMTM2YTIiLCJ0IjoiNWQ2MTllMGItMWQzZC00Y2NhLWJhZjgtNzIyNzY5ZjFlNTA3IiwicyI6IllUYzRPRFpoT1RNdFltWmtaUzAwTURBMkxUa3dObVF0TW1RM01qVXpOams0WVdZMiJ9'; 
const ARGO_PORT = process.env.ARGO_PORT || 8001;      
const CFIP = process.env.CFIP || 'www.visa.com.sg';   
const CFPORT = process.env.CFPORT || 443;             
const NAME = process.env.NAME || 'Northflank';        

// --- 哪吒监控 (可选) ---
const NEZHA_SERVER = process.env.NEZHA_SERVER || '';  
const NEZHA_PORT = process.env.NEZHA_PORT || '';      
const NEZHA_KEY = process.env.NEZHA_KEY || '';        

// ==============================================================================
// 全局变量存储订阅内容
// ==============================================================================
let GLOBAL_SUB_CONTENT = "System initializing... Please wait 30-60 seconds and refresh this page."; 

// 立即注册 /sub 路由
app.get(`/${SUB_PATH}`, (req, res) => {
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(GLOBAL_SUB_CONTENT);
});

app.get("/", function(req, res) {
  res.send("Hello world! System is running. Visit /" + SUB_PATH + " for nodes.");
});

// ==============================================================================

// 创建运行文件夹
if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(FILE_PATH);
  console.log(`${FILE_PATH} is created`);
}

function generateRandomName() {
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const npmName = generateRandomName();
const webName = generateRandomName();
const botName = generateRandomName();
const phpName = generateRandomName();
let npmPath = path.join(FILE_PATH, npmName);
let phpPath = path.join(FILE_PATH, phpName);
let webPath = path.join(FILE_PATH, webName);
let botPath = path.join(FILE_PATH, botName);
let subPath = path.join(FILE_PATH, 'sub.txt');
let listPath = path.join(FILE_PATH, 'list.txt');
let bootLogPath = path.join(FILE_PATH, 'boot.log');
let configPath = path.join(FILE_PATH, 'config.json');

// 删除旧节点
function deleteNodes() {
  try {
    if (!UPLOAD_URL || !fs.existsSync(subPath)) return;
    const fileContent = fs.readFileSync(subPath, 'utf-8');
    const decoded = Buffer.from(fileContent, 'base64').toString('utf-8');
    const nodes = decoded.split('\n').filter(line => /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line));
    if (nodes.length === 0) return;
    axios.post(`${UPLOAD_URL}/api/delete-nodes`, JSON.stringify({ nodes }), { headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  } catch (err) {}
}

// 清理文件
function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(FILE_PATH);
    files.forEach(file => {
      try {
        if (fs.statSync(path.join(FILE_PATH, file)).isFile()) fs.unlinkSync(path.join(FILE_PATH, file));
      } catch (err) {}
    });
  } catch (err) {}
}

// 生成 Config
async function generateConfig() {
  const config = {
    log: { access: '/dev/null', error: '/dev/null', loglevel: 'none' },
    inbounds: [
      { port: ARGO_PORT, protocol: 'vless', settings: { clients: [{ id: UUID, flow: 'xtls-rprx-vision' }], decryption: 'none', fallbacks: [{ dest: 3001 }, { path: "/vless-argo", dest: 3002 }, { path: "/vmess-argo", dest: 3003 }, { path: "/trojan-argo", dest: 3004 }] }, streamSettings: { network: 'tcp' } },
      { port: 3001, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID }], decryption: "none" }, streamSettings: { network: "tcp", security: "none" } },
      { port: 3002, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: UUID, level: 0 }], decryption: "none" }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/vless-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
      { port: 3003, listen: "127.0.0.1", protocol: "vmess", settings: { clients: [{ id: UUID, alterId: 0 }] }, streamSettings: { network: "ws", wsSettings: { path: "/vmess-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
      { port: 3004, listen: "127.0.0.1", protocol: "trojan", settings: { clients: [{ password: UUID }] }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/trojan-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
    ],
    dns: { servers: ["https+local://8.8.8.8/dns-query"] },
    outbounds: [ { protocol: "freedom", tag: "direct" }, {protocol: "blackhole", tag: "block"} ]
  };
  fs.writeFileSync(path.join(FILE_PATH, 'config.json'), JSON.stringify(config, null, 2));
}

function getSystemArchitecture() {
  const arch = os.arch();
  return (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') ? 'arm' : 'amd';
}

function downloadFile(fileName, fileUrl, callback) {
  if (!fs.existsSync(FILE_PATH)) fs.mkdirSync(FILE_PATH, { recursive: true });
  const writer = fs.createWriteStream(fileName);
  axios({ method: 'get', url: fileUrl, responseType: 'stream' })
    .then(response => {
      response.data.pipe(writer);
      writer.on('finish', () => { writer.close(); console.log(`Download ${path.basename(fileName)} success`); callback(null, fileName); });
      writer.on('error', err => { fs.unlink(fileName, () => {}); console.error(`Download failed: ${err.message}`); callback(err.message); });
    })
    .catch(err => { console.error(`Download failed: ${err.message}`); callback(err.message); });
}

async function downloadFilesAndRun() {  
  const arch = getSystemArchitecture();
  const filesToDownload = getFilesForArchitecture(arch);
  if (filesToDownload.length === 0) return;

  try {
    await Promise.all(filesToDownload.map(f => new Promise((resolve, reject) => {
      downloadFile(f.fileName, f.fileUrl, (err, path) => err ? reject(err) : resolve(path));
    })));
  } catch (err) { console.error('Error downloading files:', err); return; }

  // 授权
  [npmPath, phpPath, webPath, botPath].forEach(f => { if (fs.existsSync(f)) fs.chmodSync(f, 0o775); });

  // 运行哪吒
  if (NEZHA_SERVER && NEZHA_KEY) {
     if (!NEZHA_PORT) {
        const tls = ['443','8443','2096','2087','2083','2053'].includes(NEZHA_SERVER.split(':')[1]) ? 'true' : 'false';
        const conf = `client_secret: ${NEZHA_KEY}\ndebug: false\ndisable_auto_update: true\ndisable_command_execute: false\ndisable_force_update: true\ndisable_nat: false\ndisable_send_query: false\ngpu: false\ninsecure_tls: true\nip_report_period: 1800\nreport_delay: 4\nserver: ${NEZHA_SERVER}\nskip_connection_count: true\nskip_procs_count: true\ntemperature: false\ntls: ${tls}\nuuid: ${UUID}`;
        fs.writeFileSync(path.join(FILE_PATH, 'config.yaml'), conf);
        exec(`nohup ${phpPath} -c "${FILE_PATH}/config.yaml" >/dev/null 2>&1 &`).catch(()=>{});
     } else {
        const tls = ['443','8443','2096','2087','2083','2053'].includes(NEZHA_PORT) ? '--tls' : '';
        exec(`nohup ${npmPath} -s ${NEZHA_SERVER}:${NEZHA_PORT} -p ${NEZHA_KEY} ${tls} --disable-auto-update --report-delay 4 --skip-conn --skip-procs >/dev/null 2>&1 &`).catch(()=>{});
     }
  }

  // 运行 Xray
  exec(`nohup ${webPath} -c ${FILE_PATH}/config.json >/dev/null 2>&1 &`).then(() => console.log(`${webName} running`)).catch(e => console.error(e));

  // 运行 Cloudflared
  if (fs.existsSync(botPath)) {
    let args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${FILE_PATH}/boot.log --loglevel info --url http://localhost:${ARGO_PORT}`;
    if (ARGO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/)) args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${ARGO_AUTH}`;
    else if (ARGO_AUTH.match(/TunnelSecret/)) args = `tunnel --edge-ip-version auto --config ${FILE_PATH}/tunnel.yml run`;
    
    exec(`nohup ${botPath} ${args} >/dev/null 2>&1 &`).then(() => console.log(`${botName} running`)).catch(e => console.error(e));
  }
  await new Promise(r => setTimeout(r, 5000));
}

function getFilesForArchitecture(arch) {
  const base = "https://github.com/eoovve/test/releases/download/ARM/web"; 
  const url_amd = "https://amd64.ssss.nyc.mn";
  const url_arm = "https://arm64.ssss.nyc.mn";
  const root = arch === 'arm' ? url_arm : url_amd;
  
  let files = [
      { fileName: webPath, fileUrl: `${root}/web` },
      { fileName: botPath, fileUrl: `${root}/bot` }
  ];

  if (NEZHA_SERVER && NEZHA_KEY) {
     if (NEZHA_PORT) files.unshift({ fileName: npmPath, fileUrl: `${root}/agent` });
     else files.unshift({ fileName: phpPath, fileUrl: `${root}/v1` });
  }
  return files;
}

function argoType() {
  if (!ARGO_AUTH || !ARGO_DOMAIN) return;
  if (ARGO_AUTH.includes('TunnelSecret')) {
    fs.writeFileSync(path.join(FILE_PATH, 'tunnel.json'), ARGO_AUTH);
    const yml = `tunnel: ${ARGO_AUTH.split('"')[11]}\ncredentials-file: ${path.join(FILE_PATH, 'tunnel.json')}\nprotocol: http2\ningress:\n  - hostname: ${ARGO_DOMAIN}\n    service: http://localhost:${ARGO_PORT}\n    originRequest:\n      noTLSVerify: true\n  - service: http_status:404`;
    fs.writeFileSync(path.join(FILE_PATH, 'tunnel.yml'), yml);
  }
}

async function getMetaInfo() {
  try { return (await axios.get('https://ipapi.co/json/', { timeout: 3000 })).data.country_code + '_' + (await axios.get('https://ipapi.co/json/')).data.org; } 
  catch { return 'Unknown'; }
}

// =================================================================================
// ★★★ 生成链接（包含默认节点 + 你的自定义测试节点） ★★★
// =================================================================================
async function generateLinks(argoDomain) {
  const ISP = await getMetaInfo();
  const nodeName = NAME ? `${NAME}-${ISP}` : ISP;

  setTimeout(() => {
      // 1. 默认节点 (你自己的服务器节点)
      const VMESS = { v: '2', ps: `${nodeName}`, add: CFIP, port: CFPORT, id: UUID, aid: '0', scy: 'none', net: 'ws', type: 'none', host: argoDomain, path: '/vmess-argo?ed=2560', tls: 'tls', sni: argoDomain, alpn: '', fp: 'firefox'};
      const defaultLinks = `vless://${UUID}@${CFIP}:${CFPORT}?encryption=none&security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Fvless-argo%3Fed%3D2560#${nodeName}\nvmess://${Buffer.from(JSON.stringify(VMESS)).toString('base64')}\ntrojan://${UUID}@${CFIP}:${CFPORT}?security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Ftrojan-argo%3Fed%3D2560#${nodeName}\n`;

      // 2. 自定义台北节点 (之前添加的)
      const IP_A = "34.81.140.124";
      const Port_A = "10240";
      const Name_A = "🇹🇼台北_优选01";
      const VMESS_A = { v: '2', ps: Name_A, add: IP_A, port: Port_A, id: UUID, aid: '0', scy: 'none', net: 'ws', type: 'none', host: argoDomain, path: '/vmess-argo?ed=2560', tls: 'tls', sni: argoDomain, alpn: '', fp: 'firefox'};

      const IP_B = "166.0.198.81";
      const Port_B = "28015";
      const Name_B = "🇹🇼台北_优选02";
      const VMESS_B = { v: '2', ps: Name_B, add: IP_B, port: Port_B, id: UUID, aid: '0', scy: 'none', net: 'ws', type: 'none', host: argoDomain, path: '/vmess-argo?ed=2560', tls: 'tls', sni: argoDomain, alpn: '', fp: 'firefox'};

      const customLinks = `vless://${UUID}@${IP_A}:${Port_A}?encryption=none&security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Fvless-argo%3Fed%3D2560#${Name_A}\nvmess://${Buffer.from(JSON.stringify(VMESS_A)).toString('base64')}\nvless://${UUID}@${IP_B}:${Port_B}?encryption=none&security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Fvless-argo%3Fed%3D2560#${Name_B}\nvmess://${Buffer.from(JSON.stringify(VMESS_B)).toString('base64')}\n`;

      // 3. ★★★ 批量添加你的测试节点 (直接粘贴的字符串) ★★★
      const TEST_NODES = `
vless://e258977b-e413-4718-a3af-02d75492c349@8.223.63.150:443?encryption=none&security=tls&sni=tw-f0n.pages.dev&fp=chrome&alpn=h3%2Ch2%2Chttp%2F1.1&insecure=0&allowInsecure=0&ech=AEX%2BDQBB2QAgACCtazpSbFmSGI4wZhXFhkJ4h0Zm4SmDaFoiUU8yxn43MAAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA%3D&type=ws&host=tw-f0n.pages.dev&path=%2F%3Fed%3D2095#%E9%A6%99%E6%B8%AF21.01MB%2Fs
vless://e258977b-e413-4718-a3af-02d75492c349@35.221.210.167:443?encryption=none&security=tls&sni=tw-f0n.pages.dev&fp=chrome&alpn=h3%2Ch2%2Chttp%2F1.1&insecure=0&allowInsecure=0&ech=AEX%2BDQBB2QAgACCtazpSbFmSGI4wZhXFhkJ4h0Zm4SmDaFoiUU8yxn43MAAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA%3D&type=ws&host=tw-f0n.pages.dev&path=%2F%3Fed%3D2095#%E5%8F%B0%E6%B9%BE28.00MB%2Fs
vless://e258977b-e413-4718-a3af-02d75492c349@34.143.195.43:443?encryption=none&security=tls&sni=tw-f0n.pages.dev&fp=chrome&alpn=h3%2Ch2%2Chttp%2F1.1&insecure=0&allowInsecure=0&ech=AEX%2BDQBB2QAgACCtazpSbFmSGI4wZhXFhkJ4h0Zm4SmDaFoiUU8yxn43MAAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA%3D&type=ws&host=tw-f0n.pages.dev&path=%2F%3Fed%3D2095#%E6%96%B0%E5%8A%A0%E5%9D%A111.30MB%2Fs
vless://e258977b-e413-4718-a3af-02d75492c349@34.92.187.216:443?encryption=none&security=tls&sni=tw-f0n.pages.dev&fp=chrome&alpn=h3%2Ch2%2Chttp%2F1.1&insecure=0&allowInsecure=0&ech=AEX%2BDQBB2QAgACCtazpSbFmSGI4wZhXFhkJ4h0Zm4SmDaFoiUU8yxn43MAAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA%3D&type=ws&host=tw-f0n.pages.dev&path=%2F%3Fed%3D2095#%E6%96%B0%E5%8A%A0%E5%9D%A110.98MB%2Fs
vless://e258977b-e413-4718-a3af-02d75492c349@153.121.45.101:443?encryption=none&security=tls&sni=tw-f0n.pages.dev&fp=chrome&alpn=h3%2Ch2%2Chttp%2F1.1&insecure=0&allowInsecure=0&ech=AEX%2BDQBB2QAgACCtazpSbFmSGI4wZhXFhkJ4h0Zm4SmDaFoiUU8yxn43MAAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA%3D&type=ws&host=tw-f0n.pages.dev&path=%2F%3Fed%3D2095#%E6%97%A5%E6%9C%AC13.24MB%2Fs
vless://e258977b-e413-4718-a3af-02d75492c349@38.47.109.147:443?encryption=none&security=tls&sni=tw-f0n.pages.dev&fp=chrome&alpn=h3%2Ch2%2Chttp%2F1.1&insecure=0&allowInsecure=0&ech=AEX%2BDQBB2QAgACCtazpSbFmSGI4wZhXFhkJ4h0Zm4SmDaFoiUU8yxn43MAAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA%3D&type=ws&host=tw-f0n.pages.dev&path=%2F%3Fed%3D2095#%E6%97%A5%E6%9C%AC13.72MB%2Fs
vless://e258977b-e413-4718-a3af-02d75492c349@20.24.65.17:443?encryption=none&security=tls&sni=tw-f0n.pages.dev&fp=chrome&alpn=h3%2Ch2%2Chttp%2F1.1&insecure=0&allowInsecure=0&ech=AEX%2BDQBB2QAgACCtazpSbFmSGI4wZhXFhkJ4h0Zm4SmDaFoiUU8yxn43MAAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA%3D&type=ws&host=tw-f0n.pages.dev&path=%2F%3Fed%3D2095#%E9%A6%99%E6%B8%AF14.25MB%2Fs
vless://e258977b-e413-4718-a3af-02d75492c349@154.194.0.201:443?encryption=none&security=tls&sni=tw-f0n.pages.dev&fp=chrome&alpn=h3%2Ch2%2Chttp%2F1.1&insecure=0&allowInsecure=0&ech=AEX%2BDQBB2QAgACCtazpSbFmSGI4wZhXFhkJ4h0Zm4SmDaFoiUU8yxn43MAAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA%3D&type=ws&host=tw-f0n.pages.dev&path=%2F%3Fed%3D2095#%E8%8D%B7%E5%85%B015.27MB%2Fs
vless://e258977b-e413-4718-a3af-02d75492c349@47.79.91.168:443?encryption=none&security=tls&sni=tw-f0n.pages.dev&fp=chrome&alpn=h3%2Ch2%2Chttp%2F1.1&insecure=0&allowInsecure=0&ech=AEX%2BDQBB2QAgACCtazpSbFmSGI4wZhXFhkJ4h0Zm4SmDaFoiUU8yxn43MAAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA%3D&type=ws&host=tw-f0n.pages.dev&path=%2F%3Fed%3D2095#%E6%97%A5%E6%9C%AC12.89MB%2Fs
vless://e258977b-e413-4718-a3af-02d75492c349@www.wto.org:443?encryption=none&security=tls&sni=tw-f0n.pages.dev&fp=chrome&alpn=h3%2Ch2%2Chttp%2F1.1&insecure=0&allowInsecure=0&ech=AEX%2BDQBB2QAgACCtazpSbFmSGI4wZhXFhkJ4h0Zm4SmDaFoiUU8yxn43MAAEAAEAAQASY2xvdWRmbGFyZS1lY2guY29tAAA%3D&type=ws&host=tw-f0n.pages.dev&path=%2F%3Fed%3D2095#%E9%98%BF%E7%89%9B-%E4%BC%98%E9%80%89%E5%9F%9F%E5%90%8D
`;

      // 更新全局变量，页面刷新即变 (注意：这里把 TEST_NODES 加上去了)
      GLOBAL_SUB_CONTENT = Buffer.from(defaultLinks + customLinks + TEST_NODES).toString('base64');
      
      console.log("Links generated (Included your custom test nodes)!");
      uploadNodes();
  }, 2000);
}

async function extractDomains() {
  if (ARGO_AUTH && ARGO_DOMAIN) {
    console.log('ARGO_DOMAIN:', ARGO_DOMAIN);
    await generateLinks(ARGO_DOMAIN);
  } else {
      // 临时隧道逻辑省略，你用的是固定隧道
  }
}

async function uploadNodes() {
  if (!UPLOAD_URL) return;
  // ... (上传逻辑省略，保持原样)
}

function cleanFiles() {
  setTimeout(() => {
    const files = [bootLogPath, configPath, webPath, botPath];
    const cmd = process.platform === 'win32' ? `del /f /q ${files.join(' ')}` : `rm -rf ${files.join(' ')}`;
    exec(cmd + ` >/dev/null 2>&1`, ()=>{});
  }, 90000);
}
cleanFiles();

async function AddVisitTask() {
  if (AUTO_ACCESS && PROJECT_URL) {
     try { await axios.post('https://oooo.serv00.net/add-url', { url: PROJECT_URL }); } catch(e){}
  }
}

async function startserver() {
  try {
    argoType();
    deleteNodes();
    cleanupOldFiles();
    await generateConfig();
    await downloadFilesAndRun();
    await extractDomains();
    await AddVisitTask();
  } catch (error) {
    console.error('Error in startserver:', error);
  }
}

startserver();
app.listen(PORT, () => console.log(`http server is running on port:${PORT}!`));
