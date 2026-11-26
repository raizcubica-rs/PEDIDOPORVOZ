// Pruebas de regresión de la app (cotización, stock, borrador, WhatsApp, búsqueda).
// Uso: node tests/regresion.js   (requiere Playwright con Chromium)
const http=require("http"),fs=require("fs"),path=require("path");
const {chromium}=require("playwright");
const ROOT=path.join(__dirname,"..");
const TYPES={".html":"text/html",".js":"text/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/\/$/,"/index.html"));
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{"Content-Type":TYPES[path.extname(f)]||"application/octet-stream"});r.end(d)})});
let fails=0;const ok=(c,msg,extra)=>{console.log((c?"OK   ":"FALLA")+" "+msg+(c||extra===undefined?"":" → "+JSON.stringify(extra)));if(!c)fails++};
(async()=>{
  await new Promise(r=>srv.listen(0,r));const url="http://localhost:"+srv.address().port+"/index.html";
  const b=await chromium.launch();const ctx=await b.newContext();const pg=await ctx.newPage();
  const errs=[];pg.on("pageerror",e=>errs.push(e.message));
  await pg.goto(url);await pg.waitForFunction(()=>typeof parseOrder==="function"&&typeof inv!=="undefined"&&inv.length>0);
  const ev=f=>pg.evaluate(f);

  // 1. Medidas dichas en palabras = mismas medidas en números
  const med=await ev(()=>["una cortina roller blackout de 1.20 por 1.80","una cortina roller blackout de un metro veinte por un metro ochenta",
    "una cortina roller blackout de uno veinte por uno ochenta","una cortina roller blackout de 120 centimetros por 180 centimetros",
    "una cortina roller blackout de 1.20 metros por 1.80 metros"].map(t=>{const l=parseOrder(t)[0];return {code:l.code,med:l.med,total:lineTotal(l)}}));
  med.forEach((m,i)=>ok(m.code==="CRT-RBO"&&m.med&&m.med.an===1.2&&m.med.al===1.8&&Math.abs(m.total-97.2)<.001,"Medida de cortina, frase "+(i+1)+" = 1.20 × 1.80 m, S/ 97.20",m));
  const m2=await ev(()=>parseOrder("una persiana vertical de dos metros cinco por un metro")[0].med);
  ok(m2&&m2.an===2.05&&m2.al===1,"“dos metros cinco por un metro” = 2.05 × 1.00",m2);

  // 3. Metros con decimales
  const tap=await ev(()=>["2,5 metros de tapacanto blanco","dos metros y medio de tapacanto blanco","2.5 m de tapacanto blanco"].map(t=>{const l=parseOrder(t)[0];return {q:l.q,code:l.code,t:lineTotal(l)}}));
  tap.forEach((x,i)=>ok(x.code==="TAP-BLA"&&x.q===2.5&&Math.abs(x.t-1.5)<.001,"Tapacanto 2.5 m = S/ 1.50 (frase "+(i+1)+")",x));
  const ent=await ev(()=>parseOrder("2.5 bisagras rectas de 3 pulgadas")[0].q);
  ok(ent===3,"Productos por unidad siguen en enteros",ent);
  const ej=await ev(()=>{order=parseOrder("cinco bisagras rectas de tres pulgadas, un piston de 60 y una cortina roller blackout de 1.20 por 1.80");return Math.round(orderTotal()*100)/100});
  ok(ej===127.7,"Pedido de ejemplo escrito = S/ 127.70",ej);

  // 5. WhatsApp incluye lo pendiente
  const wa=await ev(()=>{order=parseOrder("un piston de 60 y un piston de 80");isDemo=false;renderOrder();return proformaText()});
  ok(/piston de 80/i.test(wa)&&/Falta confirmar/.test(wa)&&/TOTAL PARCIAL/.test(wa),"WhatsApp avisa del pistón de 80 N sin identificar",wa);
  const wa2=await ev(()=>{order=parseOrder("una cortina roller blackout");renderOrder();return proformaText()});
  ok(/falta la medida/.test(wa2),"WhatsApp avisa de cortina sin medida",wa2);

  // 6. Búsqueda por código
  const s=await ev(()=>({a:searchInv("TOR-450")[0]?.c,b:searchInv("tor450")[0]?.c,c:searchInv("tornillo").length>0,d:searchInv("TOR").every((p,i,arr)=>i>=arr.filter(x=>x.c.startsWith("TOR")).length||p.c.startsWith("TOR")),
    e:parseOrder("una caja de TOR-450")[0].code,f:parseOrder("una caja de tor 450")[0].code}));
  ok(s.a==="TOR-450"&&s.b==="TOR-450"&&s.c&&s.d,"Inventario encuentra TOR-450 por código",s);
  ok(s.e==="TOR-450"&&s.f==="TOR-450","El pedido acepta el código TOR-450",s);
  await pg.fill("#inv-q","TOR-450").catch(()=>{});
  const cnt=await ev(()=>{renderInv();return $("#inv-count").textContent});
  ok(/^1 producto/.test(cnt)||/^[1-9]\d* productos/.test(cnt)&&!/^0 /.test(cnt),"Pantalla de Inventario muestra resultados para TOR-450",cnt);

  // 2. Stock insuficiente: avisa y no registra en silencio
  const st=await ev(()=>{newOrder();order=parseOrder("diez cajas de tornillo 4 por 50");renderOrder();show("proforma");
    const before=history.length,s0=byCode("TOR-450").s;$("#btn-sell").click();
    const sheet=document.querySelector(".sheet");return {sheet:sheet?sheet.textContent:"",registered:history.length-before,s0,lineFlag:/solo hay 9/i.test(document.querySelector("#lines").textContent)}});
  ok(st.s0===9&&/pides 10, hay 9/.test(st.sheet)&&st.registered===0,"Vender 10 con stock 9 muestra aviso y no registra solo",st);
  ok(st.lineFlag,"El pedido marca el stock insuficiente en la línea",st);
  const adj=await ev(()=>{[...document.querySelectorAll(".sheet button")].find(b=>/solo lo que hay/.test(b.textContent)).click();return order.map(l=>l.q)});
  ok(adj.length===1&&adj[0]===9,"“Vender solo lo que hay” ajusta a 9",adj);
  const neg=await ev(()=>{order=parseOrder("diez cajas de tornillo 4 por 50");renderOrder();$("#btn-sell").click();
    [...document.querySelectorAll(".sheet button")].find(b=>/Registrar igual/.test(b.textContent)).click();return byCode("TOR-450").s});
  ok(neg===-1,"“Registrar igual” deja el stock en -1 (visible como faltante)",neg);

  // 4. El borrador sobrevive a recargar
  await ev(()=>{newOrder();order=parseOrder("una cortina roller blackout de 1.20 por 1.80");cliente.nombre="Prueba";renderOrder()});
  await pg.waitForTimeout(300);await pg.reload();await pg.waitForFunction(()=>typeof parseOrder==="function"&&inv.length>0);
  const dr=await ev(()=>({n:order.length,t:Math.round(orderTotal()*100)/100,demo:isDemo,cli:cliente.nombre}));
  ok(dr.n===1&&dr.t===97.2&&!dr.demo&&dr.cli==="Prueba","Al recargar vuelve el borrador (S/ 97.20), no el ejemplo",dr);
  const stk=await ev(()=>byCode("TOR-450").s);
  ok(stk===-1,"El stock guardado se mantiene tras recargar",stk);

  ok(!errs.length,"Sin errores de JavaScript",errs);
  await b.close();srv.close();
  console.log(fails?"\n"+fails+" prueba(s) fallaron":"\nTodas las pruebas pasaron");process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
