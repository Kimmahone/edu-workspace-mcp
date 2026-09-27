import {parentPort, workerData} from "node:worker_threads";
import {processDocument} from "./document-process.js";
processDocument(workerData).then(result=>parentPort?.postMessage({result})).catch(()=>parentPort?.postMessage({error:"문서를 처리하지 못했습니다. 암호·손상 여부와 지원 형식을 확인해 주세요."}));
