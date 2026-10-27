'use strict';
let downloadSelection,downloadRows=[],downloadSelectionVersion=0,downloadController=null,downloadBusy=false,downloadClosing=false,downloadRefreshTimer;
function cloneSelection(source){return{filters:Object.fromEntries(Object.entries(source.filters).map(([key,values])=>[key,[...values]])),search:source.search,metric:source.metric,min:source.min,max:source.max,minN:source.minN};}
function allSelection(){return{filters:{age:[],gender:[],ethnicity:[],expression:[]},search:'',metric:1,min:'',max:'',minN:''};}
function describeSelection(selection){
  const pieces=Object.entries(selection.filters).flatMap(([key,values])=>values.map(value=>categories[key][value]+(key==='age'?' years':'')));
  if(selection.search)pieces.push('Image ID: '+selection.search);
  const metric=metricById(selection.metric)?.label||'Mean';
  if(selection.min!=='')pieces.push(metric+' ≥ '+selection.min);
  if(selection.max!=='')pieces.push(metric+' ≤ '+selection.max);
  if(selection.minN!=='')pieces.push('At least '+selection.minN+' ratings');
  return pieces.join(' · ')||'All images';
}
function customSelection(){
  return{filters:Object.fromEntries(['age','gender','ethnicity','expression'].map(key=>[key,$$(`#download-custom input[name="download-${key}"]:checked`).map(input=>input.value)])),search:$('#download-search').value.trim(),metric:Number($('#download-metric').value),min:$('#download-min').value,max:$('#download-max').value,minN:$('#download-n').value};
}
async function refreshDownloadSelection(){
  clearTimeout(downloadRefreshTimer);
  if(downloadBusy||downloadClosing||!$('#download-dialog').open)return;
  const version=++downloadSelectionVersion;
  const mode=$('input[name="download-scope"]:checked').value;
  $('#download-custom').hidden=mode!=='custom';
  $('#download-current-summary').hidden=mode!=='current';
  const selection=mode==='all'?allSelection():mode==='custom'?customSelection():cloneSelection(downloadSelection);
  $('#download-submit').disabled=true;downloadRows=[];
  const validation=(selection.min!==''&&selection.max!==''&&Number(selection.min)>Number(selection.max))?'Minimum mean is higher than maximum mean.':selection.minN!==''&&(!Number.isInteger(Number(selection.minN))||Number(selection.minN)<1)?'Minimum ratings must be a positive whole number.':'';
  $('#download-validation').textContent=validation;
  if(validation){$('#download-match-count').textContent='Check filter values';return;}
  $('#download-match-count').textContent='Checking selection…';
  try{
    const {where,params}=conditions(selection);
    const result=await query(`SELECT i.image_id,i.image_url,i.ethnicity_code,i.gender_code,i.intended_age,i.expression_code FROM images i JOIN metric_summaries s ON i.image_key=s.image_key WHERE ${where} ORDER BY i.image_id`,params);
    if(version!==downloadSelectionVersion||downloadBusy||downloadClosing||!$('#download-dialog').open)return;
    downloadRows=result.rows;
    $('#download-match-count').textContent=formatNumber(downloadRows.length)+' image'+(downloadRows.length===1?'':'s')+' selected';
    $('#download-submit').textContent='Download '+formatNumber(downloadRows.length)+' image'+(downloadRows.length===1?'':'s');
    $('#download-submit').disabled=!downloadRows.length;
    $('#download-validation').textContent=downloadRows.length?'':'No images match these filters.';
  }catch(error){if(version===downloadSelectionVersion){$('#download-match-count').textContent='Selection unavailable';$('#download-validation').textContent=error.message;}}
}
function openDownloads(){
  if(!state.ready||downloadClosing)return;
  clearTimeout(downloadRefreshTimer);
  downloadSelection=cloneSelection(state);
  $('#download-current-summary').textContent=describeSelection(downloadSelection);
  $('#download-metric').innerHTML=metricOptions(downloadSelection.metric);
  for(const key of ['age','gender','expression','ethnicity']){
    $(`#download-${key}-choices`).innerHTML=Object.entries(categories[key]).map(([value,label])=>`<label class="choice-chip"><input type="checkbox" name="download-${key}" value="${value}"${downloadSelection.filters[key].includes(value)?' checked':''}><span>${escapeHTML(label)}</span></label>`).join('');
  }
  $('#download-search').value=downloadSelection.search;
  $('#download-min').value=downloadSelection.min;$('#download-max').value=downloadSelection.max;$('#download-n').value=downloadSelection.minN;
  $('#download-scope-current').disabled=state.filtersValid===false;
  $(state.filtersValid===false?'#download-scope-all':'#download-scope-current').checked=true;
  $('#download-progress-area').hidden=true;$('#download-validation').textContent='';
  $('#download-dialog').classList.remove('is-closing');$('#download-dialog').showModal();document.body.style.overflow='hidden';
  refreshDownloadSelection();
}
function setDownloadBusy(busy){
  downloadBusy=busy;
  $('#download-options').disabled=busy;
  $('#download-submit').disabled=busy||downloadClosing||!downloadRows.length;
  $('#download-dialog').setAttribute('aria-busy',String(busy));
  $('#download-cancel').textContent=busy?'Cancel download':'Cancel';
}
function closeDownloads(){
  if(downloadClosing)return;
  downloadClosing=true;clearTimeout(downloadRefreshTimer);downloadSelectionVersion++;downloadRows=[];
  downloadController?.abort();downloadController=null;setDownloadBusy(false);
  const dialog=$('#download-dialog');dialog.classList.add('is-closing');
  setTimeout(()=>{dialog.close();dialog.classList.remove('is-closing');document.body.style.overflow='';downloadClosing=false;},matchMedia('(prefers-reduced-motion: reduce)').matches?0:150);
}
function saveDownload(blob,filename){
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function downloadSingleFace(event,face){
  event.preventDefault();const button=event.currentTarget;
  if(button.getAttribute('aria-disabled')==='true')return;
  button.setAttribute('aria-disabled','true');
  try{
    const response=await fetch(faceApiUrl('/api/originals?id='+encodeURIComponent(face.image_id)),{credentials:'same-origin',signal:AbortSignal.timeout(90000)});
    if(!response.ok)throw new Error('The image could not be retrieved.');
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length<24||![137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value))throw new Error('The original PNG is unavailable.');
    const blob=new Blob([bytes],{type:'image/png'});
    saveDownload(blob,face.image_id+'.png');
  }catch(error){toast('Download failed. Please try again.');}
  finally{button.removeAttribute('aria-disabled');}
}
async function startPictureDownload(event){
  event.preventDefault();if(downloadBusy||downloadClosing||!$('#download-dialog').open||!downloadRows.length)return;
  clearTimeout(downloadRefreshTimer);downloadSelectionVersion++;
  const faces=[...downloadRows];setDownloadBusy(true);$('#download-progress-area').hidden=false;$('#download-progress').removeAttribute('value');$('#download-progress-label').textContent='Checking '+formatNumber(faces.length)+' original PNG files…';
  $('#download-validation').textContent='';
  const controller=new AbortController();downloadController=controller;
  const url=faceApiUrl('/api/originals?'+new URLSearchParams({ids:faces.map(face=>face.image_id).join(',')}));
  try{
    const response=await fetch(url+'&check=1',{credentials:'same-origin',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]),cache:'no-store'});
    if(!response.ok)throw new Error('Original images could not be retrieved. Please try again.');
    const info=await response.json();
    if(info.count!==faces.length||info.format!=='zip'||info.imageFormat!=='png'||!Number.isSafeInteger(info.totalBytes)||info.totalBytes<1)throw new Error('The original image selection could not be verified.');
    if(downloadController!==controller||controller.signal.aborted||downloadClosing||!$('#download-dialog').open)return;
    // Let the browser stream the archive directly to disk. The full collection
    // is over a gigabyte and must never be assembled in browser memory.
    const link=document.createElement('a');link.href=url;link.download=info.filename;document.body.append(link);link.click();link.remove();
    downloadController=null;setDownloadBusy(false);closeDownloads();
    toast(`Download started: ${formatNumber(faces.length)} original PNG images. See your browser's downloads for progress.`);
  }catch(error){if(downloadController===controller&&!controller.signal.aborted)pictureDownloadError(error.name==='TimeoutError'?'The original-image service took too long. Please try again.':error.message);}
}
function pictureDownloadError(message){downloadController?.abort();downloadController=null;setDownloadBusy(false);$('#download-progress-area').hidden=true;$('#download-validation').textContent=message;}
function setupDownloads(){
  $('#download-pictures').addEventListener('click',openDownloads);
  $('#download-form').addEventListener('submit',startPictureDownload);
  $('#download-options').addEventListener('change',event=>{
    // Text/number edits are already handled on input; their later blur must not
    // disable a ready submit button between pointerdown and click.
    if(event.target.matches('select,input[type=checkbox],input[type=radio]'))refreshDownloadSelection();
  });
  $('#download-custom').addEventListener('input',event=>{
    if(event.target.type==='checkbox'||downloadBusy||downloadClosing)return;
    clearTimeout(downloadRefreshTimer);downloadSelectionVersion++;downloadRows=[];$('#download-submit').disabled=true;
    $('#download-match-count').textContent='Checking selection…';
    downloadRefreshTimer=setTimeout(refreshDownloadSelection,200);
  });
  $('#download-cancel').addEventListener('click',closeDownloads);$('#close-download').addEventListener('click',closeDownloads);
  $('#download-dialog').addEventListener('cancel',event=>{event.preventDefault();closeDownloads();});
  $('#download-dialog').addEventListener('click',event=>{if(event.target!==event.currentTarget)return;const b=event.currentTarget.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)closeDownloads();});
}
