import {NextRequest,NextResponse} from 'next/server';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const {url}=await req.json();
  if(typeof url!=='string'||url.length>2048)return NextResponse.json({error:'URL inválida'},{status:400});
  const target=new URL(url);
  if(target.hostname!=='xtrem7.sbs'||target.protocol!=='http:'||target.pathname!=='/get.php')return NextResponse.json({error:'Este servidor não está configurado para conexão intermediária.'},{status:400});
  if(!target.searchParams.get('username')||!target.searchParams.get('password'))return NextResponse.json({error:'Credenciais ausentes.'},{status:400});
  const ac=new AbortController();const timeout=setTimeout(()=>ac.abort(),12000);
  let response:Response;
  try{response=await fetch(target.toString(),{redirect:'error',cache:'no-store',signal:ac.signal,headers:{Accept:'text/plain,application/x-mpegURL,*/*'}})}finally{clearTimeout(timeout)}
  if(!response.ok)return NextResponse.json({error:'Servidor IPTV respondeu '+response.status},{status:502});
  const type=response.headers.get('content-type')||'';
  if(type.includes('text/html'))return NextResponse.json({error:'O provedor retornou HTML em vez de M3U.'},{status:502});
  const size=Number(response.headers.get('content-length')||0);
  if(size>12_000_000)return NextResponse.json({error:'Lista excede o limite de 12 MB.'},{status:413});
  const reader=response.body?.getReader();if(!reader)throw Error('Resposta vazia');
  const chunks:Uint8Array[]=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>12_000_000){await reader.cancel();return NextResponse.json({error:'Lista excede o limite de 12 MB.'},{status:413})}chunks.push(value)}
  const bytes=new Uint8Array(total);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length}
  const playlist=new TextDecoder().decode(bytes);
  if(!playlist.includes('#EXTM3U'))return NextResponse.json({error:'Resposta não é uma lista M3U válida.'},{status:502});
  return new NextResponse(playlist,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
 }catch{return NextResponse.json({error:'Não foi possível consultar o provedor. Verifique se ele está disponível.'},{status:502})}
}