// Recorrido completo como lo usarían el dueño y el ayudante (Playwright).
// Uso: node tests/flujo.js
const http=require("http"),fs=require("fs"),path=require("path");
const {chromium}=require("playwright");
const ROOT=path.join(__dirname,"..");
const TYPES={".html":"text/html",".js":"text/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]).replace(/\/$/,"/index.html"));
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{"Content-Type":TYPES[path.extname(f)]||"application/octet-stream"});r.end(d)})});
let fails=0;const ok=(c,msg,extra)=>{console.log((c?"OK   ":"FALLA")+" "+msg+(c||extra===undefined?"":" → "+JSON.stringify(extra)));if(!c)fails++};
(async()=>{
  await new Promise(r=>srv.listen(0,r));const url="http://localhost:"+srv.address().port+"/";
  const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:400,height:850}});const pg=await ctx.newPage();
  const errs=[];pg.on("pageerror",e=>errs.push(e.message));
  const boot=async()=>{await pg.waitForFunction(()=>typeof parseOrder==="function"&&typeof inv!=="undefined"&&inv.length>0)};
  await pg.goto(url);await boot();
  const ev=(f,a)=>pg.evaluate(f,a);
  const sheetText=()=>ev(()=>{const s=document.querySelector(".sheet");return s?s.textContent:""});
  const clickSheet=re=>ev(r=>{const b=[...document.querySelectorAll(".sheet button")].find(x=>new RegExp(r).test(x.textContent));if(!b)throw new Error("sin botón "+r);b.click()},re);

  // ---------- Dueño: primer uso ----------
  ok(await ev(()=>role)==="dueno","Sin PIN, la app abre como dueño");
  await ev(()=>{$("#btn-config").click()});
  await pg.fill("#cf-pin","4321");await clickSheet("^Guardar$");
  const code=await ev(()=>$("#rec-code")&&$("#rec-code").textContent);
  ok(/^\d{4}-\d{4}$/.test(code||""),"Al poner PIN se muestra un código de recuperación",code);
  await clickSheet("Ya lo anoté");

  // Producto con precio por mayor
  await ev(()=>{show("inventario");showProduct(byCode("BIS-010"))});await clickSheet("Editar ficha");
  await pg.fill("#pf-pm","1.80");await pg.fill("#pf-md","12");await clickSheet("Guardar cambios");
  const bis=await ev(()=>({p:byCode("BIS-010").p,pm:byCode("BIS-010").pm,md:byCode("BIS-010").md}));
  ok(bis.pm===1.8&&bis.md===12,"El dueño pone precio por mayor S/ 1.80 desde 12",bis);

  // Otra marca del mismo producto
  await ev(()=>{showProduct(byCode("BIS-010"))});await clickSheet("otra marca");
  await pg.fill("#pf-marca","Hettich");await pg.fill("#pf-p","4.50");await pg.fill("#pf-s","40");await pg.fill("#pf-c","BIS-010-HET");await clickSheet("Guardar producto");
  const het=await ev(()=>{const p=byCode("BIS-010-HET");return p&&{n:p.n,p:p.p,s:p.s,marca:p.ficha.marca}});
  ok(het&&het.p===4.5&&het.marca==="Hettich"&&het.s===40,"Se crea la marca Hettich con su precio y stock",het);
  const dup=await ev(()=>{productForm({n:"x",cat:"Otros",syn:[],ficha:{}},true);$("#pf-n").value="Prueba";$("#pf-p").value="1";$("#pf-c").value="bis-010-het";[...document.querySelectorAll(".sheet button")].find(x=>/Guardar producto/.test(x.textContent)).click();return !!byCode("BIS-010-HET")&&custom.filter(c=>codeKey(c.c)==="bis010het").length});
  ok(dup===1,"No deja repetir un código",dup);await ev(()=>closeSheet());
  ok(await ev(()=>searchInv("BIS-010-HET")[0].c)==="BIS-010-HET","Búsqueda por el código nuevo");

  // ---------- Reabrir: modo ayudante ----------
  await pg.reload();await boot();
  ok(await ev(()=>role)==="ayudante","Con PIN, al abrir la app empieza en modo ayudante");
  const lock=await ev(()=>{show("resumen");return {lock:!$("#res-lock").hidden,kpis:$("#kpis").hidden,caja:!$("#caja").hidden}});
  ok(lock.lock&&lock.kpis&&lock.caja,"Ayudante: ve la caja pero no el total de ventas",lock);
  await ev(()=>{show("inventario");showProduct(byCode("BIS-010"))});await clickSheet("Editar");
  ok(/Solo el dueño/.test(await sheetText()),"Ayudante: editar un producto pide PIN");
  for(let i=0;i<5;i++){await pg.fill("#pin-in","0000");await clickSheet("Entrar como dueño")}
  await pg.fill("#pin-in","4321");await clickSheet("Entrar como dueño");
  ok(/Espera/.test(await sheetText())&&await ev(()=>role)==="ayudante","5 PIN errados bloquean, incluso con el PIN correcto");
  await pg.reload();await boot();
  await ev(()=>{show("inventario");showProduct(byCode("BIS-010"))});await clickSheet("Editar");await pg.fill("#pin-in","4321");await clickSheet("Entrar como dueño");
  ok(await ev(()=>role)==="ayudante","El bloqueo sigue tras recargar la página");
  await ev(()=>{setPinLock({});closeSheet()});
  const exp=await ev(()=>{$("#btn-cli-xlsx").click();return /Solo el dueño/.test(document.querySelector(".sheet")?.textContent||"")});
  ok(exp,"Ayudante: exportar clientes pide PIN");await ev(()=>closeSheet());

  // ---------- Ayudante vende ----------
  await ev(()=>{show("pedido");newOrder()});
  await pg.click("#type-box summary").catch(()=>{});
  await pg.fill("#txt","dos metros y medio de tapacanto blanco, 4 soportes cromados, una caja de TOR-450 y una bisagra recta de tres pulgadas");
  await pg.click("#btn-parse");
  const v1=await ev(()=>order.map(l=>({c:l.code,q:l.q,st:l.status,cands:l.cands.slice(0,3)})));
  ok(v1.length===4&&v1[0].q===2.5&&v1[2].c==="TOR-450","Ayudante escribe un pedido con decimales y código",v1);
  const amb=v1[3];ok(amb.st==="check"&&amb.cands.includes("BIS-010")&&amb.cands.includes("BIS-010-HET"),"Bisagra con dos marcas: pregunta cuál",amb);
  const chips=await ev(()=>[...document.querySelectorAll("#lines .line")][3].querySelector(".chips").textContent);
  ok(/Hettich/.test(chips)&&/4\.50/.test(chips),"Los botones muestran marca y precio",chips);
  const hv=await ev(()=>{const l=parseOrder("una bisagra recta de tres pulgadas hettich")[0];return {c:l.code,st:l.status}});
  ok(hv.c==="BIS-010-HET"&&hv.st==="ok","Diciendo la marca elige Hettich directo",hv);
  // precio por cantidad (desde 12)
  const pm=await ev(()=>{order=parseOrder("12 bisagras rectas de 3 pulgadas sin marca");const l=order[0];l.code="BIS-010";l.status="ok";renderOrder();return {u:unitPrice(l),tag:priceTag(l),t:lineTotal(l)}});
  ok(pm.u===1.8&&pm.tag==="por mayor"&&Math.abs(pm.t-21.6)<.001,"12 bisagras toman el precio por mayor automático",pm);
  const pm2=await ev(()=>{order[0].q=11;renderOrder();return unitPrice(order[0])});
  ok(pm2===bis.p,"11 bisagras vuelven al precio normal",pm2);
  // venta por mayor dictada
  const dm=await ev(()=>{newOrder();addFromText("al por mayor 5 bisagras rectas de 3 pulgadas");const l=order[0];l.code="BIS-010";l.status="ok";renderOrder();return {mayor,u:unitPrice(l),chk:$("#mayor-on").checked,n:order.length}});
  ok(dm.mayor&&dm.u===1.8&&dm.chk&&dm.n===1,"Decir “al por mayor” activa los precios por mayor",dm);
  // ayudante intenta precio especial
  await ev(()=>{[...document.querySelectorAll("#lines [aria-label='Cambiar precio']")][0].click()});
  ok(/Solo el dueño/.test(await sheetText()),"Ayudante: cambiar el precio de una línea pide PIN");
  await pg.fill("#pin-in","4321");await clickSheet("Entrar como dueño");
  ok(/Precio para esta venta/.test(await sheetText()),"Con PIN abre el precio especial");
  await pg.fill("#pp-in","1.50");await clickSheet("Usar este precio");
  const esp=await ev(()=>({u:unitPrice(order[0]),tag:priceTag(order[0]),wa:proformaText()}));
  ok(esp.u===1.5&&esp.tag==="precio especial"&&/S\/ 1\.50/.test(esp.wa),"Precio especial S/ 1.50 sale en la proforma",esp);
  await pg.reload();await boot();
  const kept=await ev(()=>({u:order[0]&&unitPrice(order[0]),mayor}));
  ok(kept.u===1.5&&kept.mayor,"Precio especial y “por mayor” sobreviven a recargar",kept);
  await ev(()=>{show("proforma");$("#pago").value="Yape";$("#btn-sell").click()});
  const venta=await ev(()=>{const v=history[history.length-1];return {t:v.t,metodo:v.metodo,item:v.items[0],vend:v.vendedor,mayor:v.mayor}});
  ok(venta.t===7.5&&venta.metodo==="Yape"&&venta.item.tipo==="precio especial"&&venta.item.lista===bis.p&&venta.vend==="Ayudante","La venta guarda precio especial, precio de lista y quién vendió",venta);

  // ---------- Pedido con entrega (cortina) y cobro del saldo ----------
  await ev(()=>{show("pedido");newOrder();addFromText("una cortina roller blackout de un metro veinte por un metro ochenta");show("proforma")});
  const en=await ev(()=>({on:$("#ent-on").checked,ini:$("#ent-ini").textContent}));
  ok(en.on&&en.ini==="S/ 48.60","Cortina activa entrega posterior con 50% inicial",en);
  await ev(()=>{$("#pago").value="Efectivo";$("#btn-sell").click()});
  const pend=await ev(()=>pedidos.filter(p=>p.estado==="pendiente"&&!p.ejemplo).map(p=>p.saldo));
  ok(pend.length===1&&pend[0]===48.6,"Queda pedido pendiente con saldo S/ 48.60",pend);

  // ---------- Caja ----------
  await ev(()=>{show("resumen")});
  await pg.fill("#caja-ap","100");await ev(()=>[...document.querySelectorAll("#caja button")].find(b=>/Abrir caja/.test(b.textContent)).click());
  await ev(()=>{const p=pedidos.find(p=>p.estado==="pendiente"&&!p.ejemplo);cobrarSaldo(p)});await clickSheet("Confirmar entrega");
  await ev(()=>salidaSheet());await pg.fill("#sal-monto","10");await pg.fill("#sal-motivo","movilidad");await clickSheet("Guardar salida");
  const esp2=await ev(()=>cajaCuentas(cajas[hoyISO(0)]));
  ok(esp2.esp===100+48.6+48.6-10,"Caja: 100 + efectivo (inicial y saldo) − salida",esp2);
  await ev(()=>cierreSheet());await pg.fill("#cierre-contado",String(esp2.esp-2));await clickSheet("^Cerrar caja$");
  const cierre=await ev(()=>cajas[hoyISO(0)].cierre);ok(cierre&&cierre.dif===-2&&cierre.por==="Ayudante","Cierre de caja marca que faltan S/ 2.00 y quién cerró",cierre);

  // ---------- Archivos ----------
  const files=await ev(async()=>{order=parseOrder("4 soportes cromados y un piston de 80");isDemo=false;renderOrder();const pdf=buildPdf();const c=drawProforma();return {pdf:pdf.size,h:c.height}});
  ok(files.pdf>5000&&files.h>800,"PDF y JPG se generan",files);

  // ---------- Importar Excel con marcas y precio por mayor ----------
  const imp=await ev(async()=>{await loadLib("xlsx");
    const ws=XLSX.utils.aoa_to_sheet([["Código","Producto","Marca","Precio","Precio por mayor","Mayor desde","Stock"],["","Pistón a gas 60 N","Hafele",9.5,8,10,20],["","Pistón a gas 60 N","Blum",11,"","",5],["PIS-100","Pistón a gas 100 N","",9.2,"","",30]]);
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"I");const buf=XLSX.write(wb,{bookType:"xlsx",type:"array"});
    const rows=await parseXlsx(new File([buf],"i.xlsx"));previewImport(rows,"i.xlsx",false);
    [...document.querySelectorAll(".sheet button")].find(b=>/Importar/.test(b.textContent)).click();
    const v=inv.filter(p=>p.n==="Pistón a gas 60 N");return {variants:v.map(p=>({c:p.c,p:p.p,m:p.ficha.marca||"",pm:p.pm})),p100:byCode("PIS-100").p}});
  ok(imp.variants.length===2&&imp.variants.some(v=>v.c==="PIS-060"&&v.m==="Hafele"&&v.p===9.5&&v.pm===8)&&imp.variants.some(v=>v.c!=="PIS-060"&&v.m==="Blum"&&v.p===11)&&imp.p100===9.2,"Importar: el pistón sin marca pasa a Hafele y Blum se crea aparte",imp);

  // ---------- Respaldo y restauración ----------
  const bk=await ev(async()=>{let got=null;const orig=saveFile;saveFile=async(n,d)=>{got=d;return true};
    role="dueno";configSheet();[...document.querySelectorAll(".sheet button")].find(b=>/Descargar respaldo/.test(b.textContent)).click();saveFile=orig;closeSheet();
    const data=JSON.parse(got);return {ventas:data.history.length,custom:data.custom.length,pin:data.negocio.pin}});
  ok(bk.ventas===2&&bk.custom>=2&&bk.pin==="4321","El respaldo incluye ventas, productos nuevos y datos del negocio",bk);

  // ---------- Olvidé el PIN ----------
  await ev(()=>{role="ayudante";$("#btn-config").click()});await clickSheet("Olvidé mi PIN");
  await pg.fill("#rec-in","1111-2222");await clickSheet("Recuperar acceso");
  ok(/no es correcto/.test(await sheetText()),"Código de recuperación equivocado no entra");
  await pg.fill("#rec-in",code);await clickSheet("Recuperar acceso");
  const rec=await ev(()=>({role,pin:negocio.pin,cfg:!!$("#cf-pin")}));
  ok(rec.role==="dueno"&&rec.pin===""&&rec.cfg,"Con el código correcto entra y pide un PIN nuevo",rec);
  await ev(()=>closeSheet());

  // ---------- Borrar todo exige escribir BORRAR ----------
  await ev(()=>configSheet());await clickSheet("Borrar todos los datos");
  await pg.fill("#cf-borrar","borra");await clickSheet("definitivamente");
  ok(await ev(()=>history.length)===2,"Borrar todo no procede sin escribir BORRAR");
  await ev(()=>closeSheet());

  // ---------- Sin internet ----------
  await pg.evaluate(()=>navigator.serviceWorker.ready);await pg.reload();await boot();
  await ctx.setOffline(true);await pg.reload();await boot();
  ok(await ev(()=>history.length)===2,"Sin internet la app abre con sus datos");
  await ctx.setOffline(false);

  ok(!errs.length,"Sin errores de JavaScript",errs);
  await b.close();srv.close();
  console.log(fails?"\n"+fails+" prueba(s) fallaron":"\nTodo el recorrido pasó");process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
