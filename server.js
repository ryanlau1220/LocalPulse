import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';

const port = Number(process.env.PORT || 3000);
function publicAddress(ip) {
  if (net.isIPv4(ip)) { const p=ip.split('.').map(Number); return !(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&p[1]===168||p[0]===100&&p[1]>=64&&p[1]<=127); }
  return false; // Restrict outbound checks to public IPv4 addresses.
}
async function inspect(url) {
  let current = new URL(url);
  for (let redirects=0; redirects<4; redirects++) {
    if (!['http:','https:'].includes(current.protocol) || current.username || current.password || (current.port && !['80','443'].includes(current.port))) throw Error('Enter a public HTTP or HTTPS website URL.');
    const addresses=(await lookup(current.hostname,{all:true})).filter(a=>a.family===4);
    if (!addresses.length || addresses.some(a=>!publicAddress(a.address))) throw Error('Only public IPv4 websites can be checked.');
    // Pin the resolved address to prevent DNS rebinding between validation and connection.
    const transport = await import(current.protocol === 'https:' ? 'node:https' : 'node:http');
    const response=await new Promise((resolve,reject)=>{
      const req=transport.request(current,{method:'GET',headers:{'User-Agent':'LocalPulse/1.0 (website audit)'},lookup:(_host,opts,cb)=>opts.all?cb(null,[addresses[0]]):cb(null,addresses[0].address,4),timeout:10000},res=>{
        if (res.statusCode>=300 && res.statusCode<400 && res.headers.location) {res.resume(); resolve({redirect:res.headers.location}); return;}
        let data=''; res.setEncoding('utf8'); res.on('data',chunk=>{data+=chunk;if(data.length>1000000) res.destroy();}); res.on('end',()=>resolve({status:res.statusCode,html:data,contentType:res.headers['content-type']||''})); res.on('error',reject);
      }); req.on('timeout',()=>req.destroy(Error('Website timed out.')));req.on('error',reject);req.end();
    });
    if(response.redirect){current=new URL(response.redirect,current);continue;}
    if(!response.contentType.includes('text/html')) throw Error('The URL did not return an HTML page.');
    const html=response.html;
    return {url:current.href,status:response.status,https:current.protocol==='https:',viewport:/<meta\s+[^>]*name\s*=\s*["']?viewport\b/i.test(html),whatsapp:/wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com/i.test(html),booking:/\b(book\s*(now|online|an? appointment)|reserve\s*(now|a table)|appointment|reservations?)\b/i.test(html),title:(html.match(/<title[^>]*>([^<]*)<\/title>/i)||[])[1]?.trim()||null};
  }
  throw Error('Too many redirects.');
}
const server=http.createServer(async(req,res)=>{
  try {
    const u=new URL(req.url,'http://localhost');
    if(u.pathname==='/api/audit'&&req.method==='POST') {
      let body='';for await(const chunk of req){body+=chunk;if(body.length>5000) throw Error('Request too large.');}
      const data=JSON.parse(body);const result=await inspect(data.url);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;
    }
    const file=u.pathname==='/'?'index.html':u.pathname.slice(1);
    if(!['index.html','style.css','app.js'].includes(file)){res.writeHead(404);res.end('Not found');return;}
    const data=await readFile(path.join('public',file));res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html'});res.end(data);
  } catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message||'Unable to check website.'}));}
});
server.listen(port,'127.0.0.1',()=>console.log(`LocalPulse running at http://localhost:${port}`));
