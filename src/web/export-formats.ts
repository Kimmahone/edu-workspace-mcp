export const exportFormats = {
 slides: {extension:'pptx',mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation'},
 sheet: {extension:'xlsx',mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
} as const;
export function exportFormat(kind:string){if(kind!=='slides'&&kind!=='sheet')throw new Error('PPTX 또는 Excel 형식을 선택해 주세요.');return exportFormats[kind];}
