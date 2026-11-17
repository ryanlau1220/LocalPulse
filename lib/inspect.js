import { lookup } from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';

function publicAddress(ip) {
  if (net.isIPv4(ip)) { const p=ip.split('.').map(Number); return !(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&p[1]===168||p[0]===100&&p[1]>=64&&p[1]<=127); }
  return false; // Restrict outbound checks to public IPv4 addresses.
}
export function inspectHtml(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const description = tags.some(tag => /\bname\s*=\s*["']?description\b/i.test(tag) && /\bcontent\s*=\s*["']\s*[^\s"']+[^"']*/i.test(tag));
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || null;
  return {
    title, description,
    viewport: tags.some(tag => /\bname\s*=\s*["']?viewport\b/i.test(tag)),
    h1: /<h1(?:\s|>)/i.test(html),
    phone: /href\s*=\s*["']\s*tel:/i.test(html),
    email: /href\s*=\s*["']\s*mailto:/i.test(html),
    social: /href\s*=\s*["'][^"']*(?:instagram\.com|facebook\.com|tiktok\.com)/i.test(html),
    whatsapp: /wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com/i.test(html),
    booking: /\b(book\s*(now|online|an? appointment)|reserve\s*(now|a table)|appointment|reservations?)\b/i.test(html),
  };
}
export async function inspect(url) {
  let current = new URL(url);
  for (let redirects=0; redirects<4; redirects++) {
    if (!['http:','https:'].includes(current.protocol) || current.username || current.password || (current.port && !['80','443'].includes(current.port))) throw Error('Enter a public HTTP or HTTPS website URL.');
    const addresses=(await lookup(current.hostname,{all:true})).filter(a=>a.family===4);
    if (!addresses.length || addresses.some(a=>!publicAddress(a.address))) throw Error('Only public IPv4 websites can be checked.');
    // Pin the resolved address to prevent DNS rebinding between validation and connection.
    const transport = current.protocol === 'https:' ? https : http;
    const response=await new Promise((resolve,reject)=>{
      const req=transport.request(current,{method:'GET',headers:{'User-Agent':'LocalPulse/1.0 (website audit)'},lookup:(_host,opts,cb)=>opts.all?cb(null,[addresses[0]]):cb(null,addresses[0].address,4),timeout:10000},res=>{
        if (res.statusCode>=300 && res.statusCode<400 && res.headers.location) {res.resume(); resolve({redirect:res.headers.location}); return;}
        let data=''; res.setEncoding('utf8'); res.on('data',chunk=>{data+=chunk;if(data.length>1000000) res.destroy();}); res.on('end',()=>resolve({status:res.statusCode,html:data,contentType:res.headers['content-type']||''})); res.on('error',reject);
      }); req.on('timeout',()=>req.destroy(Error('Website timed out.')));req.on('error',reject);req.end();
    });
    if(response.redirect){current=new URL(response.redirect,current);continue;}
    if(!response.contentType.includes('text/html')) throw Error('The URL did not return an HTML page.');
    const html=response.html;
    return {url:current.href,status:response.status,https:current.protocol==='https:',...inspectHtml(html)};
  }
  throw Error('Too many redirects.');
}
