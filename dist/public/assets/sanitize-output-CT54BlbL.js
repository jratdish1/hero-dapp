const t=[/<script[\s>]/i,/javascript\s*:/i,/on\w+\s*=/i,/data\s*:\s*text\/html/i,/vbscript\s*:/i,/expression\s*\(/i,/<iframe[\s>]/i,/<object[\s>]/i,/<embed[\s>]/i,/<form[\s>]/i,/<link[\s>]/i,/<meta[\s>]/i,/<base[\s>]/i,/&#x?[0-9a-f]+;/i,/%3[Cc]script/i,/\\u003[Cc]/i];function r(i){if(!i)return"";let e=i.replace(/<[^>]*>/g,"");return t.forEach(s=>{e=e.replace(s,"[removed]")}),e=e.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,""),e.length>5e4&&(e=e.slice(0,5e4)+`

[Content truncated — exceeds maximum length]`),e.trim()}export{r as s};
