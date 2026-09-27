import {processDocument} from '../../src/web/document-process.js';
import {checkDocument} from '../../src/web/document-check.js';
self.onmessage = async ({data}) => {
  try {
    if(data.input) checkDocument(data.input);
    if(data.other) checkDocument(data.other);
    if(data.markdown?.length > 200000) throw new Error('문서가 너무 깁니다.');
    self.postMessage({result:await processDocument(data)});
  } catch { self.postMessage({error:'문서를 처리하지 못했습니다. 암호·손상 여부와 지원 형식을 확인해 주세요.'}); }
};
