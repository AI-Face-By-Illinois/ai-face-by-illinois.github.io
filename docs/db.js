/* A local worker keeps database work off the interface thread. */
importScripts('vendor/sql-wasm.js');
let database;
function setBrowseOrder(seed){
  // One shuffled permutation per page load keeps pagination and filters consistent.
  const keys=query('SELECT image_key FROM images ORDER BY image_key').rows.map(row=>row.image_key);
  let randomState=Number(seed)>>>0;
  for(let index=keys.length-1;index>0;index--){
    randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;
    const other=Math.floor(randomState/4294967296*(index+1));
    [keys[index],keys[other]]=[keys[other],keys[index]];
  }
  const ranks=new Map(keys.map((key,index)=>[key,index]));
  database.create_function('browse_rank',key=>ranks.get(key)??keys.length);
}
function readableSQL(source){
  const cleaned=source.replace(/--[^\r\n]*/g,' ').replace(/\/\*[\s\S]*?\*\//g,' ').replace(/'(?:''|[^'])*'/g,"''").replace(/"(?:""|[^"])*"/g,'""').replace(/`(?:``|[^`])*`/g,'``').trim();
  if(!/^(SELECT|WITH)\b/i.test(cleaned))throw new Error('Only SELECT queries and WITH … SELECT queries are available.');
  if(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX|ANALYZE|LOAD_EXTENSION)\b/i.test(cleaned))throw new Error('This collection is read-only. Use a SELECT query.');
  if(cleaned.replace(/;\s*$/,'').includes(';'))throw new Error('Run one query at a time.');
}
function query(sql,params=[],limit=30000,positional=false){
  const statement=database.prepare(sql);const rows=[];let columns=[];let truncated=false;
  try{statement.bind(params);columns=statement.getColumnNames();while(statement.step()){if(rows.length>=limit){truncated=true;break;}rows.push(positional?statement.get():statement.getAsObject());}}finally{statement.free();}
  return{rows,columns,truncated};
}
self.onmessage=async(event)=>{const{id,type,sql,params,limit}=event.data;try{
  if(type==='init'){const SQL=await initSqlJs({locateFile:f=>'vendor/'+f});const response=await fetch('data/faces.sqlite');if(!response.ok)throw new Error('The dataset could not be loaded ('+response.status+').');const bytes=new Uint8Array(await response.arrayBuffer());database=new SQL.Database(bytes);database.run('PRAGMA query_only = ON');setBrowseOrder(event.data.shuffleSeed);self.postMessage({id,result:{ready:true}});return;}
  if(!database)throw new Error('The collection is still opening. Please try again in a moment.');
  if(type==='lab')readableSQL(sql);
  const started=performance.now();const result=query(sql,params,limit,type==='lab');result.elapsedMs=Math.round(performance.now()-started);self.postMessage({id,result});
}catch(error){self.postMessage({id,error:error.message||String(error)});}};
