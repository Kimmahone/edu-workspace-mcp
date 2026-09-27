import { chromium } from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {templates} from '../dist/web/drafts.js';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const t of templates){
  const page=await browser.newPage({viewport:{width:t.id==='tracker'?1100:t.id==='slides'?1000:794,height:t.id==='slides'?590:1050},deviceScaleFactor:1});
  await page.setContent(await readFile(`outputs/design-${t.id}.html`,'utf8'));
  await page.screenshot({path:`web/assets/examples/${t.id}.png`,animations:'disabled'});
  if(t.id==='slides')await page.addStyleTag({content:'@page{size:720pt 405pt;margin:0}@media print{body{padding:0;background:white}article{width:720pt;max-width:none;margin:0;box-shadow:none;break-after:page}svg{width:720pt;height:405pt}}'});
  else if(t.id==='tracker')await page.addStyleTag({content:'@page{size:A4 landscape;margin:10mm}'});
  else await page.addStyleTag({content:'@page{size:A4;margin:18mm} article,header{break-inside:avoid} .doc-page{break-inside:auto}'});
  await page.pdf({path:`web/assets/examples/${t.id}.pdf`,preferCSSPageSize:true,printBackground:true});
  await page.close();
 }
}finally{await browser.close();}
console.log('Rendered 12 actual previews and PDFs.');
