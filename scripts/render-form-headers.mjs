import {chromium} from '@playwright/test';
import {designs} from '../dist/web/design.js';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const[id,p]of Object.entries(designs)){
 const page=await browser.newPage({viewport:{width:1600,height:400},deviceScaleFactor:1});
 await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:${p.ink};font-family:Arial,sans-serif;color:white;overflow:hidden}.rule{height:12px;background:${p.accent}}main{padding:62px 86px}small{color:#C7D9E5;letter-spacing:5px;font-size:17px}h1{font-size:72px;letter-spacing:-3px;margin:25px 0}p{font-size:21px;color:#D5E1E9}.a,.b,.c{position:absolute;border-radius:32px}.a{left:1200px;top:72px;width:205px;height:205px;background:${p.accent}}.b{left:1125px;top:230px;width:130px;height:130px;background:#DDE8DB}.c{left:1420px;top:260px;width:75px;height:75px;background:#EABD68}</style><div class="rule"></div><main><small>A MOMENT TO DISCOVER</small><h1>Learn. Think. Grow.</h1><p>나의 생각을 발견하는 시간</p></main><div class="a"></div><div class="b"></div><div class="c"></div>`);
 await page.screenshot({path:`web/assets/illustrations/forms-header-${id}.png`});await page.close();
}}finally{await browser.close();}
