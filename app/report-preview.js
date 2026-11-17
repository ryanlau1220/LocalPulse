import { chineseFindings } from '../lib/chinese';
import { evidenceFor } from '../lib/evidence';

export default function ReportPreview({current, settings, findings, language}) {
 const isMs=language==='ms', isZh=language==='zh';
 const text=(en,ms,zh)=>isZh?zh:isMs?ms:en;
 const finding=findings[0], evidence=finding&&evidenceFor(current,finding.title);
 const title=finding&&(isZh?(finding.zh||chineseFindings[finding.title]?.[0]||finding.title):isMs?(finding.ms||finding.title):finding.title);
 const priority=finding&&(isZh?({High:'高',Medium:'中',Review:'待审核'}[finding.priority]||finding.priority):isMs?({High:'Tinggi',Medium:'Sederhana',Review:'Semak'}[finding.priority]||finding.priority):finding.priority);
 const effort=finding&&(isZh?String(finding.effort||'').replace('hours','小时').replace('hour','小时').replace('days','天').replace('day','天').replace('min','分钟'):isMs?String(finding.effort||'').replace('hours','jam').replace('hour','jam').replace('days','hari').replace('day','hari').replace('min','minit'):finding.effort);
 const detail=finding&&(isZh?(finding.zhDetail||(finding.title==='Review mobile usability'&&current.audit?.mobileOverflow?`在 ${current.audit.mobileOverflow.viewportWidth}px 宽的视图中，页面宽度达到 ${current.audit.mobileOverflow.documentWidth}px，标题被截断。请允许文字换行并消除横向溢出。`:chineseFindings[finding.title]?.[1])||finding.detail):isMs?(finding.msDetail||finding.detail):finding.detail);
 return <div className="preview-sheet report-preview-sheet">
  <div className="report-preview-header"><span className="preview-brand"><img src="/localpulse-mark.svg" alt=""/><span className="brand-wordmark">local<span>pulse</span></span></span><small>{text('WEBSITE PROPOSAL','CADANGAN LAMAN WEB','网站建议书')}</small></div>
  <h2>{text('Website presence audit & proposal','Audit kehadiran laman web dan cadangan','网站现况审核与建议书')}</h2>
  {current.demo&&<div className="preview-sample">{text('SAMPLE ONLY · FICTIONAL BUSINESS','CONTOH SAHAJA · PERNIAGAAN REKAAN','仅供示范 · 虚构商家')}</div>}
  <div className="report-preview-details"><div><small>{text('PREPARED FOR','DISEDIAKAN UNTUK','呈交给')}</small><div className="preview-client">{current.logo&&<span className="biz-avatar"><img src={current.logo} alt=""/></span>}<strong>{current.name}</strong></div><p>{current.location}</p></div><div><small>{text('PREPARED BY','DISEDIAKAN OLEH','制作方')}</small><strong>{settings.business||text('To be confirmed','Akan disahkan','待确认')}</strong><p>{settings.contact||text('Contact to be confirmed','Maklumat hubungan akan disahkan','联系信息待确认')}</p></div></div>
  <div className="report-preview-price"><strong>{text('INDICATIVE STARTING PRICE','HARGA PERMULAAN ANGGARAN','参考起价')}: RM {settings.price||'—'}</strong><p>{text('Editable estimate; scope, timeline and price are subject to agreement.','Anggaran boleh diubah; skop, tempoh dan harga tertakluk kepada persetujuan.','此价格仅供参考；项目范围、时间和费用须经双方同意。')}</p></div>
  <div className="report-preview-overview"><h3>{text('Audit overview','Ringkasan audit','审核概览')}</h3><p>{text('This preliminary report summarises website findings, supporting evidence and practical next steps.','Laporan awal ini merumuskan penemuan laman web, bukti sokongan dan langkah seterusnya.','本初步报告概述网站检查结果、相关证据及实际后续步骤。')}</p></div>
  <h3 className="report-preview-section">{text('FINDINGS AND NEXT STEPS','PENEMUAN DAN LANGKAH SETERUSNYA','发现与后续建议')}</h3>
  {finding&&<div className="report-preview-finding"><div><strong>1. {title}</strong><small>{priority} · {effort}</small><p>{detail}</p></div>{evidence&&<div className="report-preview-evidence"><small>{text('SCREENSHOT','TANGKAPAN SKRIN','截图')}</small><div><img src={evidence.src} alt={text('First finding evidence','Bukti penemuan pertama','首项发现的证据')}/>{evidence.region&&<span style={{left:`${evidence.region.x*100}%`,top:`${evidence.region.y*100}%`,width:`${evidence.region.width*100}%`,height:`${evidence.region.height*100}%`}}/>}</div></div>}</div>}
 </div>;
}
