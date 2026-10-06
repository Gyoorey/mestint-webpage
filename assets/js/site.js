
(function(){
"use strict";
var $ = function(id){ return document.getElementById(id); };
function on(ids, fn){
  ids.forEach(function(i){ var e=$(i); if(e){ e.addEventListener("input", fn); e.addEventListener("change", fn);} });
  try{ fn(); }catch(err){}
}
function fmt(v, d){ return (Math.round(v*Math.pow(10,d))/Math.pow(10,d)).toFixed(d); }
function eng(v, unit){
  var a=Math.abs(v);
  if(a>=1e9) return fmt(v/1e9,2)+" G"+unit;
  if(a>=1e6) return fmt(v/1e6,2)+" M"+unit;
  if(a>=1e3) return fmt(v/1e3,2)+" k"+unit;
  if(a>=1)   return fmt(v,2)+" "+unit;
  if(a>=1e-3)return fmt(v*1e3,1)+" m"+unit;
  if(a>=1e-6)return fmt(v*1e6,1)+" µ"+unit;
  return fmt(v*1e9,1)+" n"+unit;
}
function bytes(b){
  if(b>=1048576) return fmt(b/1048576,2)+" MB";
  if(b>=1024) return fmt(b/1024,1)+" kB";
  return Math.round(b)+" B";
}
function svgOpen(w,h,label){ return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+label+'">'; }
function verdict(el, ok, html){ el.className = "verdict" + (ok?"":" bad"); el.innerHTML = html; }

/* ---------- 1 · energy budget ---------- */
on(["e-cap","e-life","e-idle","e-inf"], function(){
  var cap=+$("e-cap").value, life=+$("e-life").value, idle=+$("e-idle").value, inf=+$("e-inf").value/100;
  $("e-cap-v").textContent = cap+" mAh";
  $("e-life-v").textContent = life+" month"+(life>1?"s":"");
  $("e-idle-v").textContent = idle+" µW";
  $("e-inf-v").textContent = fmt(inf,2)+" mJ";
  var E = cap/1000*3.0*3600;                 // joules, 3 V cell
  var secs = life*30.44*24*3600;
  var ceil = E/secs;                          // watts
  var left = ceil - idle*1e-6;
  var rate = left>0 ? left/(inf*1e-3) : 0;
  $("e-store").textContent = fmt(E,0)+" J";
  $("e-ceil").textContent = eng(ceil,"W");
  $("e-left").textContent = left>0 ? eng(left,"W") : "none";
  $("e-rate").textContent = left<=0 ? "0 Hz" : (rate>=1 ? fmt(rate,2)+" Hz" : "1 per "+fmt(1/rate,0)+" s");
  var need = 1.0;                             // 1 Hz target
  var el=$("e-verdict");
  if(left<=0){
    verdict(el,false,"<b>Standby alone exceeds the budget.</b> The device cannot meet this service life even if it never runs an inference — fix the standby current before touching the model.");
  } else if(rate>=need){
    verdict(el,true,"<b>Feasible at 1 Hz</b> with "+fmt(rate/need,1)+"× headroom. Spend it on a bigger model, a longer life, or a smaller cell.");
  } else {
    verdict(el,false,"<b>Short of 1 Hz by "+fmt(need/rate,0)+"×.</b> Four ways out: cut energy per inference (Session 3), cut the rate with a cascade (§1.8), enlarge the store, or relax the specification. Training a better model is not one of them.");
  }
});

/* ---------- 2 · aliasing ---------- */
on(["a-f","a-fs"], function(){
  var f0=+$("a-f").value/2, fs=+$("a-fs").value;
  $("a-f-v").textContent = fmt(f0,1)+" Hz";
  $("a-fs-v").textContent = fs+" Hz";
  var nyq = fs/2;
  var al = Math.abs(f0 - Math.round(f0/fs)*fs);
  var aliased = f0 > nyq + 1e-9;
  var W=680,H=170,x0=44,x1=660,y0=14,yc=88,amp=62;
  var s = svgOpen(W,H,"live aliasing plot");
  s += '<line x1="'+x0+'" y1="'+yc+'" x2="'+x1+'" y2="'+yc+'" class="ax"/>';
  var pts=[], i;
  for(i=0;i<=300;i++){ var t=i/300; pts.push((x0+(x1-x0)*t).toFixed(1)+" "+(yc-amp*Math.sin(2*Math.PI*f0*t)).toFixed(1)); }
  s += '<path d="M'+pts.join(" L")+'" class="ser" opacity="0.45"/>';
  if(aliased){
    var sign = Math.sin(2*Math.PI*f0*(0.25/Math.max(al,0.001)))>=0?1:-1;
    var ap=[];
    for(i=0;i<=300;i++){ var t2=i/300; ap.push((x0+(x1-x0)*t2).toFixed(1)+" "+(yc-amp*Math.sin(2*Math.PI*al*t2)*sign).toFixed(1)); }
    s += '<path d="M'+ap.join(" L")+'" class="acc" stroke-width="2.2"/>';
  }
  var n = Math.min(Math.floor(fs)+1, 80);
  for(i=0;i<=n;i++){
    var ts=i/fs; if(ts>1) break;
    var xx=x0+(x1-x0)*ts, yy=yc-amp*Math.sin(2*Math.PI*f0*ts);
    s += '<line x1="'+xx.toFixed(1)+'" y1="'+yc+'" x2="'+xx.toFixed(1)+'" y2="'+yy.toFixed(1)+'" class="grid"/>';
    s += '<circle cx="'+xx.toFixed(1)+'" cy="'+yy.toFixed(1)+'" r="3.6" class="tlf"/>';
  }
  s += '<text x="'+x0+'" y="'+(H-6)+'" class="lbl">1 second of signal · teal dots are the samples</text></svg>';
  $("a-plot").innerHTML = s;
  $("a-nyq").textContent = fmt(nyq,1)+" Hz";
  $("a-alias").textContent = aliased ? fmt(al,2)+" Hz" : "none";
  $("a-alias").className = aliased ? "hi" : "ok";
  var el=$("a-verdict");
  if(aliased) verdict(el,false,"<b>Aliased.</b> The "+fmt(f0,1)+" Hz component is now indistinguishable from a genuine "+fmt(al,2)+" Hz component. Nothing downstream can undo it — the fix is an analog filter before the sampler, or a higher f<sub>s</sub>.");
  else verdict(el,true,"<b>Correctly sampled.</b> f<sub>s</sub> = "+fs+" Hz is above 2 × "+fmt(f0,1)+" Hz, so the waveform is fully determined by the dots. Note how few samples per period that still is — reconstruction is sinc interpolation, not connect-the-dots.");
});

/* ---------- 3 · STFT resolution ---------- */
on(["s-L","s-fs","s-ov"], function(){
  var L = Math.pow(2, +$("s-L").value), fs = +$("s-fs").value, ov = +$("s-ov").value;
  var hop = Math.max(1, Math.round(L*(1-ov/100)));
  $("s-L-v").textContent = L+" samples";
  $("s-fs-v").textContent = (fs/1000)+" kHz";
  $("s-ov-v").textContent = ov+" % overlap";
  var df = fs/L, dt = L/fs*1000, fps = fs/hop;
  $("s-df").textContent = fmt(df,1)+" Hz";
  $("s-dt").textContent = fmt(dt,1)+" ms";
  $("s-fps").textContent = fmt(fps,0)+" /s";
  var macs = fps * (L/2)*Math.log2(L)*2;
  $("s-cost").textContent = eng(macs,"MAC/s");
  var W=680,H=140,x0=20,y0=16,x1=660,y1=112;
  var cols = Math.max(2, Math.min(26, Math.round(1000/dt)));
  var rows = Math.max(2, Math.min(18, Math.round(4000/df)));
  var cw=(x1-x0)/cols, ch=(y1-y0)/rows;
  var s = svgOpen(W,H,"time-frequency tiling for the chosen window length");
  for(var r=0;r<rows;r++) for(var c=0;c<cols;c++){
    var hot = (r===Math.floor(rows/2) && c===Math.floor(cols/2));
    s += '<rect x="'+(x0+c*cw).toFixed(1)+'" y="'+(y0+r*ch).toFixed(1)+'" width="'+(cw-0.6).toFixed(1)+'" height="'+(ch-0.6).toFixed(1)+'" '+(hot?'class="accf" opacity="0.6"':'fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.4"')+'/>';
  }
  s += '<text x="'+x0+'" y="'+(H-8)+'" class="lbl">each tile = one STFT coefficient · '+fmt(dt,1)+' ms × '+fmt(df,1)+' Hz</text></svg>';
  $("s-plot").innerHTML = s;
  var el=$("s-verdict");
  if(dt > 40) verdict(el,false,"<b>Too smeared in time for transients.</b> A "+fmt(dt,0)+" ms window cannot localise a plosive or a click; you will see it, but not when it happened.");
  else if(df > 120) verdict(el,false,"<b>Too coarse in frequency for pitch.</b> At "+fmt(df,0)+" Hz per bin the harmonics of a male voice fall inside a single bin.");
  else verdict(el,true,"<b>A workable compromise</b> for speech: "+fmt(dt,0)+" ms of smearing, "+fmt(df,0)+" Hz of resolution, "+fmt(fps,0)+" frames per second. Note that raising overlap raises the frame rate — and therefore the energy — without improving either resolution.");
});

/* ---------- 4 · layer cost + roofline ---------- */
var DEV = {
  "m4":  {name:"Cortex-M4F @ 80 MHz", peak:160e6, bw:320e6, sram:128*1024},
  "m7":  {name:"Cortex-M7 @ 480 MHz", peak:960e6, bw:1.9e9, sram:512*1024},
  "npu": {name:"MCU + microNPU",      peak:5e10,  bw:4e9,   sram:1024*1024},
  "cpu": {name:"mobile CPU core",     peak:2.5e10,bw:1.2e10,sram:2*1024*1024}
};
on(["l-type","l-hw","l-cin","l-cout","l-k","l-bits","l-dev"], function(){
  var type=$("l-type").value, hw=+$("l-hw").value, cin=+$("l-cin").value, cout=+$("l-cout").value,
      k=+$("l-k").value, bits=+$("l-bits").value, dev=DEV[$("l-dev").value];
  $("l-hw-v").textContent = hw+" × "+hw;
  $("l-cin-v").textContent = cin;
  $("l-cout-v").textContent = cout;
  $("l-k-v").textContent = k+" × "+k;
  $("l-bits-v").textContent = bits+"-bit";
  var kEl=$("l-k").parentNode; kEl.style.opacity = (type==="dense"||type==="point") ? 0.35 : 1;
  var params, macs, outAct, inAct;
  var B = bits/8;
  if(type==="conv"){ params=k*k*cin*cout; macs=hw*hw*k*k*cin*cout; inAct=hw*hw*cin; outAct=hw*hw*cout; }
  else if(type==="dw"){ params=k*k*cin; macs=hw*hw*k*k*cin; inAct=hw*hw*cin; outAct=hw*hw*cin; }
  else if(type==="point"){ params=cin*cout; macs=hw*hw*cin*cout; inAct=hw*hw*cin; outAct=hw*hw*cout; }
  else { params=cin*cout; macs=cin*cout; inAct=cin; outAct=cout; }
  var moved=(params+inAct+outAct)*B;
  var ai = macs/moved;
  var ridge = dev.peak/dev.bw;
  var attain = Math.min(dev.peak, dev.bw*ai);
  var tmin = macs/attain;
  $("l-params").textContent = bytes(params*B);
  $("l-macs").textContent = eng(macs,"MAC");
  $("l-act").textContent = bytes((inAct+outAct)*B);
  $("l-ai").textContent = fmt(ai,1)+" MAC/B";
  $("l-lat").textContent = eng(tmin,"s");
  var bound = ai < ridge;
  $("l-bound").textContent = bound ? "memory" : "compute";
  $("l-bound").className = bound ? "hi" : "ok";
  /* roofline plot */
  var W=680,H=210,x0=56,x1=650,yb=170,yt=20;
  function LX(v){ var a=Math.log10(0.05), b=Math.log10(1000); return x0+(Math.log10(Math.max(v,0.05))-a)/(b-a)*(x1-x0); }
  function LY(v){ var a=Math.log10(dev.peak/1e4), b=Math.log10(dev.peak*1.6); return yb-(Math.log10(Math.max(v,Math.pow(10,a)))-a)/(b-a)*(yb-yt); }
  var s = svgOpen(W,H,"roofline for the selected device with this layer plotted on it");
  s += '<line x1="'+x0+'" y1="'+yb+'" x2="'+x1+'" y2="'+yb+'" class="ax"/><line x1="'+x0+'" y1="'+yt+'" x2="'+x0+'" y2="'+yb+'" class="ax"/>';
  [0.1,1,10,100,1000].forEach(function(v){
    s += '<line x1="'+LX(v).toFixed(1)+'" y1="'+yt+'" x2="'+LX(v).toFixed(1)+'" y2="'+yb+'" class="grid"/>';
    s += '<text x="'+LX(v).toFixed(1)+'" y="'+(yb+15)+'" class="lbl" text-anchor="middle">'+v+'</text>';
  });
  var d="M"+LX(0.05).toFixed(1)+" "+LY(dev.bw*0.05).toFixed(1)+" L"+LX(ridge).toFixed(1)+" "+LY(dev.peak).toFixed(1)+" L"+LX(1000).toFixed(1)+" "+LY(dev.peak).toFixed(1);
  s += '<path d="'+d+'" class="acc" stroke-width="2.2"/>';
  s += '<line x1="'+LX(ridge).toFixed(1)+'" y1="'+LY(dev.peak).toFixed(1)+'" x2="'+LX(ridge).toFixed(1)+'" y2="'+yb+'" class="grid" stroke-dasharray="4 3"/>';
  s += '<text x="'+LX(ridge).toFixed(1)+'" y="'+(yb+30)+'" class="lbl" text-anchor="middle">ridge '+fmt(ridge,2)+'</text>';
  s += '<circle cx="'+LX(ai).toFixed(1)+'" cy="'+LY(attain).toFixed(1)+'" r="6.5" class="tlf"/>';
  s += '<text x="'+(LX(ai)+11).toFixed(1)+'" y="'+(LY(attain)+4).toFixed(1)+'" class="lblb">your layer</text>';
  s += '<text x="'+x0+'" y="'+(yt-4)+'" class="lbl">'+dev.name+' · peak '+eng(dev.peak,"MAC/s")+' · BW '+eng(dev.bw,"B/s")+'</text>';
  s += '<text x="'+((x0+x1)/2)+'" y="'+(H-6)+'" class="lbl" text-anchor="middle">arithmetic intensity, MAC per byte (log)</text></svg>';
  $("l-plot").innerHTML = s;
  var el=$("l-verdict");
  var fits = (inAct+outAct)*B < dev.sram*0.8;
  var msg = bound
    ? "<b>Memory-bound.</b> This layer sits left of the ridge, so reducing its MAC count buys almost nothing — the machine is waiting for operands. Raise reuse (fuse it with its neighbour, or process a larger tile) or lower the bytes (quantize)."
    : "<b>Compute-bound.</b> This layer is right of the ridge, so fewer MACs really does mean less time. Pruning, factorisation and a cheaper operator all pay here.";
  if(!fits) msg += " <b>And it does not fit:</b> "+bytes((inAct+outAct)*B)+" of live activations against "+bytes(dev.sram)+" of SRAM.";
  verdict(el, !bound && fits, msg);
});

/* ---------- 6 · quantization playground ---------- */
var WH = {"lo": -1.15, "hi": 1.15, "n": 160, "c": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 3, 2, 1, 1, 1, 1, 2, 3, 0, 2, 2, 1, 3, 1, 4, 4, 5, 1, 4, 5, 4, 1, 5, 3, 6, 11, 16, 16, 19, 16, 25, 35, 39, 71, 68, 122, 124, 146, 153, 183, 188, 216, 273, 270, 284, 309, 276, 308, 304, 265, 234, 228, 186, 168, 140, 139, 92, 79, 58, 44, 31, 22, 22, 16, 11, 13, 14, 7, 3, 4, 0, 3, 3, 7, 6, 4, 7, 3, 2, 5, 1, 4, 4, 0, 3, 2, 4, 0, 3, 0, 1, 1, 2, 1, 0, 0, 1, 2, 0, 0, 0, 1, 4, 0, 0, 3, 3, 3, 2, 8, 2, 2, 0, 3, 0, 2, 2, 0, 1, 0, 0, 0, 0, 0, 0, 1]};
on(["q-bits","q-clip","q-mode"], function(){
  var bits=+$("q-bits").value, clipPct=+$("q-clip").value/10, mode=$("q-mode").value;
  $("q-bits-v").textContent = bits+" bits ("+Math.pow(2,bits)+" levels)";
  $("q-clip-v").textContent = fmt(clipPct,1)+" %";
  var cw = (WH.hi-WH.lo)/WH.n, tot=0, i;
  for(i=0;i<WH.n;i++) tot+=WH.c[i];
  var centers=[], counts=WH.c;
  for(i=0;i<WH.n;i++) centers.push(WH.lo+(i+0.5)*cw);
  var lo, hi;
  if(mode==="mm"){
    lo=null; for(i=0;i<WH.n;i++){ if(counts[i]>0){ lo=centers[i]; break; } }
    hi=null; for(i=WH.n-1;i>=0;i--){ if(counts[i]>0){ hi=centers[i]; break; } }
    $("q-clip").disabled = true; $("q-clip").parentNode.style.opacity=0.35;
  } else {
    $("q-clip").disabled = false; $("q-clip").parentNode.style.opacity=1;
    var target=(100-clipPct)/200, acc=0, k;
    lo=centers[0]; hi=centers[WH.n-1];
    for(k=0;k<WH.n;k++){ acc+=counts[k]/tot; if(acc>=target){ lo=centers[k]; break; } }
    acc=0; for(k=WH.n-1;k>=0;k--){ acc+=counts[k]/tot; if(acc>=target){ hi=centers[k]; break; } }
  }
  var L=Math.pow(2,bits)-1, step=(hi-lo)/L;
  var sig=0, err=0;
  for(i=0;i<WH.n;i++){
    if(!counts[i]) continue;
    var x=centers[i], xc=Math.max(lo,Math.min(hi,x));
    var q=Math.round((xc-lo)/step), xh=lo+q*step;
    sig+=counts[i]*x*x; err+=counts[i]*(x-xh)*(x-xh);
  }
  var sqnr = 10*Math.log10(sig/Math.max(err,1e-15));
  var clipped=0; for(i=0;i<WH.n;i++){ if(centers[i]<lo||centers[i]>hi) clipped+=counts[i]; }
  $("q-step").textContent = fmt(step*1000,2)+" ×10⁻³";
  $("q-sqnr").textContent = fmt(sqnr,1)+" dB";
  $("q-clipped").textContent = fmt(100*clipped/tot,2)+" %";
  $("q-size").textContent = fmt(bits/32*100,0)+" % of fp32";
  var W=680,H=190,x0=42,x1=660,yb=150,yt=16;
  function X(v){ return x0+(v-WH.lo)/(WH.hi-WH.lo)*(x1-x0); }
  var mx=0; for(i=0;i<WH.n;i++) mx=Math.max(mx,counts[i]);
  var s = svgOpen(W,H,"weight histogram with the current quantization grid overlaid");
  for(i=0;i<WH.n;i++){
    if(!counts[i]) continue;
    var hgt=(yb-yt)*counts[i]/mx;
    s += '<rect x="'+X(WH.lo+i*cw).toFixed(1)+'" y="'+(yb-hgt).toFixed(1)+'" width="'+((x1-x0)/WH.n).toFixed(1)+'" height="'+hgt.toFixed(1)+'" fill="currentColor" opacity="0.3"/>';
  }
  var nshow = Math.min(L, 96);
  for(i=0;i<=nshow;i++){
    var v = lo + (hi-lo)*i/nshow;
    s += '<line x1="'+X(v).toFixed(1)+'" y1="'+(yb+4)+'" x2="'+X(v).toFixed(1)+'" y2="'+(yb+14)+'" class="acc" opacity="0.75"/>';
  }
  s += '<line x1="'+X(lo).toFixed(1)+'" y1="'+yt+'" x2="'+X(lo).toFixed(1)+'" y2="'+(yb+16)+'" class="tl" stroke-width="1.8"/>';
  s += '<line x1="'+X(hi).toFixed(1)+'" y1="'+yt+'" x2="'+X(hi).toFixed(1)+'" y2="'+(yb+16)+'" class="tl" stroke-width="1.8"/>';
  s += '<line x1="'+x0+'" y1="'+yb+'" x2="'+x1+'" y2="'+yb+'" class="ax"/>';
  s += '<text x="'+x0+'" y="'+(H-6)+'" class="lbl">5 425 weights · copper ticks are the representable levels ('+(nshow<L?"first "+nshow+" shown":"all "+L)+')</text>';
  s += '<text x="'+X(lo).toFixed(1)+'" y="'+(yt-2)+'" class="lbl" text-anchor="middle">α</text>';
  s += '<text x="'+X(hi).toFixed(1)+'" y="'+(yt-2)+'" class="lbl" text-anchor="middle">β</text></svg>';
  $("q-plot").innerHTML = s;
  var el=$("q-verdict");
  if(sqnr>40) verdict(el,true,"<b>"+fmt(sqnr,0)+" dB — comfortable.</b> Above roughly 35–40 dB per layer, int8 post-training quantization usually costs a fraction of a point of accuracy.");
  else if(sqnr>25) verdict(el,true,"<b>"+fmt(sqnr,0)+" dB — marginal.</b> Workable for robust layers; check the first and last layers separately, they are usually the sensitive ones.");
  else verdict(el,false,"<b>"+fmt(sqnr,0)+" dB — this layer will break.</b> Either widen the bit budget, or fix the range: notice how much SQNR the clipping percentile buys you at constant bit width.");
});

/* ---------- 7 · sparsity break-even ---------- */
on(["p-vb","p-ib","p-sp"], function(){
  var vb=+$("p-vb").value, ib=+$("p-ib").value, sp=+$("p-sp").value;
  $("p-vb-v").textContent = vb+"-bit values";
  $("p-ib-v").textContent = ib+"-bit indices";
  $("p-sp-v").textContent = sp+" % removed";
  var keep=(100-sp)/100;
  var dense=vb, sparse=keep*(vb+ib);
  var be = 100*(1 - vb/(vb+ib));
  $("p-dense").textContent = fmt(dense,1)+" bits/weight";
  $("p-sparse").textContent = fmt(sparse,1)+" bits/weight";
  $("p-ratio").textContent = fmt(dense/sparse,2)+"×";
  $("p-be").textContent = fmt(be,0)+" %";
  var W=680,H=120,x0=150,x1=640;
  function BX(v){ return x0+(v/Math.max(vb,sparse,1))*(x1-x0); }
  var s = svgOpen(W,H,"bar comparison of dense and sparse storage per weight");
  s += '<rect x="'+x0+'" y="24" width="'+(BX(dense)-x0).toFixed(1)+'" height="26" fill="currentColor" opacity="0.35"/>';
  s += '<text x="'+(x0-8)+'" y="42" class="lblb" text-anchor="end">dense</text>';
  s += '<rect x="'+x0+'" y="62" width="'+(BX(sparse)-x0).toFixed(1)+'" height="26" class="'+(sparse<dense?"tlf":"accf")+'" opacity="0.6"/>';
  s += '<text x="'+(x0-8)+'" y="80" class="lblb" text-anchor="end">sparse (CSR)</text>';
  s += '<text x="'+(BX(dense)+8).toFixed(1)+'" y="42" class="lbl">'+fmt(dense,1)+' bits</text>';
  s += '<text x="'+(BX(sparse)+8).toFixed(1)+'" y="80" class="lbl">'+fmt(sparse,1)+' bits</text>';
  s += '<text x="'+x0+'" y="110" class="lbl">per stored weight, amortised over the whole tensor</text></svg>';
  $("p-plot").innerHTML = s;
  var el=$("p-verdict");
  if(sparse>=dense) verdict(el,false,"<b>The sparse model is LARGER.</b> At "+vb+"-bit values you must remove more than "+fmt(be,0)+" % of the weights before compressed-sparse storage even breaks even — and being smaller is still not the same as being faster.");
  else verdict(el,true,"<b>"+fmt(dense/sparse,2)+"× smaller in flash.</b> Break-even was "+fmt(be,0)+" %. For a <i>speedup</i> on a general-purpose core you typically need 80–90 % sparsity, or hardware that decodes a fixed N:M pattern.");
});

/* ---------- 8 · softmax temperature ---------- */
var LOG=[8.1,3.4,3.0,1.2,-0.4,-2.1], LNAMES=["stop","up","off","go","yes","dog"];
on(["t-T"], function(){
  var T=+$("t-T").value/10;
  $("t-T-v").textContent = "T = "+fmt(T,1);
  var m=Math.max.apply(null, LOG.map(function(v){return v/T;}));
  var ex=LOG.map(function(v){ return Math.exp(v/T-m); });
  var Z=ex.reduce(function(a,b){return a+b;},0);
  var p=ex.map(function(v){ return v/Z; });
  var Hh=-p.reduce(function(a,v){ return a+(v>0? v*Math.log(v):0); },0);
  $("t-H").textContent = fmt(Hh,3)+" nats";
  $("t-top").textContent = fmt(p[0]*100,1)+" %";
  $("t-second").textContent = fmt(p[1]*100,1)+" %";
  var W=680,H=180,x0=54,yb=140,yt=18;
  var s = svgOpen(W,H,"softmax distribution at the chosen temperature");
  var bw=64, gap=32;
  p.forEach(function(v,i){
    var x=x0+i*(bw+gap), hgt=(yb-yt)*v;
    s += '<rect x="'+x+'" y="'+(yb-hgt).toFixed(1)+'" width="'+bw+'" height="'+hgt.toFixed(1)+'" class="'+(i===0?"accf":"tlf")+'" opacity="'+(i===0?0.85:0.55)+'"/>';
    s += '<text x="'+(x+bw/2)+'" y="'+(yb-hgt-6).toFixed(1)+'" class="lbl" text-anchor="middle">'+fmt(v,3)+'</text>';
    s += '<text x="'+(x+bw/2)+'" y="'+(yb+16)+'" class="lbl" text-anchor="middle">'+LNAMES[i]+'</text>';
  });
  s += '<line x1="'+x0+'" y1="'+yb+'" x2="'+(x0+6*(bw+gap)-gap)+'" y2="'+yb+'" class="ax"/>';
  s += '<text x="'+x0+'" y="'+(H-6)+'" class="lbl">teacher logits [8.1, 3.4, 3.0, 1.2, −0.4, −2.1]</text></svg>';
  $("t-plot").innerHTML = s;
  var el=$("t-verdict");
  if(T<1.4) verdict(el,false,"<b>Almost a one-hot vector.</b> At this temperature the soft target carries barely more information than the label itself, and distillation degenerates into ordinary training.");
  else if(T>7) verdict(el,false,"<b>Nearly uniform.</b> The ranking is still there but the useful contrast has been washed out, and the student now spends capacity matching the teacher's noisiest logits.");
  else verdict(el,true,"<b>The useful range.</b> The wrong-class structure — “stop, and it is much more like <i>up</i> and <i>off</i> than like <i>dog</i>” — is visible without drowning the correct class. This is the dark knowledge the one-hot label never contained.");
});
})();


/* ---------- new · gradient descent ---------- */
(function(){
  var $=function(i){return document.getElementById(i);};
  if(!$("g-eta")) return;
  function f(v,d){return (Math.round(v*Math.pow(10,d))/Math.pow(10,d)).toFixed(d);}
  function run(){
    var eta=+$("g-eta").value/1000*1.0, k=+$("g-k").value, n=+$("g-n").value;
    eta = +$("g-eta").value/1000;
    $("g-eta-v").textContent=f(eta,3); $("g-k-v").textContent=k; $("g-n-v").textContent=n;
    var W=680,H=250,cx=340,cy=125,sx=95,sy=95;
    var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="gradient descent path on loss contours">';
    var levels=[0.02,0.1,0.3,0.7,1.4,2.5,4,6];
    levels.forEach(function(L){
      var pts=[];for(var i=0;i<=90;i++){var th=i/90*2*Math.PI;var r=Math.sqrt(2*L/(Math.cos(th)*Math.cos(th)+k*Math.sin(th)*Math.sin(th)));
        pts.push((cx+sx*r*Math.cos(th)).toFixed(1)+" "+(cy-sy*r*Math.sin(th)).toFixed(1));}
      s+='<path d="M'+pts.join(" L")+' Z" class="grid" opacity="0.6"/>';
    });
    var w1=-3,w2=0.5,path=[],loss=0,first=-1,div=false;
    for(var t=0;t<=n;t++){
      loss=0.5*(w1*w1+k*w2*w2);
      if(first<0 && loss<1e-3) first=t;
      var X=cx+sx*w1, Y=cy-sy*w2;
      if(!isFinite(loss)||Math.abs(w1)>50||Math.abs(w2)>50){div=true;break;}
      path.push([Math.max(4,Math.min(W-4,X)),Math.max(4,Math.min(H-4,Y))]);
      w1=w1-eta*w1; w2=w2-eta*k*w2;
    }
    s+='<path d="M'+path.map(function(p){return p[0].toFixed(1)+" "+p[1].toFixed(1);}).join(" L")+'" class="acc" stroke-width="1.8"/>';
    path.forEach(function(p,i){ s+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="'+(i===0?4:2.4)+'" class="accf"/>'; });
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="4" fill="currentColor"/>';
    s+='<text x="10" y="'+(H-8)+'" class="lbl">horizontal: w₁ (shallow) · vertical: w₂ (steep, curvature κ)</text></svg>';
    $("g-plot").innerHTML=s;
    var lim=2/k;
    $("g-lim").textContent=f(lim,3);
    $("g-loss").textContent=div?"diverged":(loss<1e-4?loss.toExponential(1):f(loss,4));
    $("g-steps").textContent=first>=0?first:"> "+n;
    var el=$("g-verdict");
    if(div||eta>=lim){ el.className="verdict bad"; el.innerHTML="<b>Unstable.</b> η exceeds 2/κ = "+f(lim,3)+": the steep direction overshoots further on every step. Lower η — or rescale the features so κ falls."; }
    else if(first<0){ el.className="verdict bad"; el.innerHTML="<b>Stable but slow.</b> The shallow direction shrinks only by a factor (1 − η) per step. The best fixed η is limited by the steep direction, so progress along the shallow one is ≈ κ times slower — the real cost of a badly conditioned problem."; }
    else { el.className="verdict"; el.innerHTML="<b>Converged in "+first+" steps.</b> Try κ = 1 (perfectly scaled features): one well-chosen step suffices. Then try κ = 30 and find the best η you can."; }
  }
  ["g-eta","g-k","g-n"].forEach(function(i){$(i).addEventListener("input",run);});
  run();
})();

/* ---------- new · decision threshold ---------- */
(function(){
  var $=function(i){return document.getElementById(i);};
  if(!$("r-p")) return;
  function f(v,d){return (Math.round(v*Math.pow(10,d))/Math.pow(10,d)).toFixed(d);}
  function erf(x){var s=x<0?-1:1;x=Math.abs(x);var t=1/(1+0.3275911*x);
    var y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return s*y;}
  function Phi(x){return 0.5*(1+erf(x/Math.SQRT2));}
  function pdf(x){return Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);}
  function run(){
    var p=+$("r-p").value/100, d=+$("r-d").value/10, th=+$("r-t").value/10;
    $("r-p-v").textContent=Math.round(p*100)+" %"; $("r-d-v").textContent=f(d,1); $("r-t-v").textContent=f(th,1);
    var N=1000, P=N*p, Ng=N-P;
    var TP=P*(1-Phi(th-d)), FN=P-TP, FP=Ng*(1-Phi(th)), TN=Ng-FP;
    var rec=TP/P, pre=(TP+FP)>0?TP/(TP+FP):0, acc=(TP+TN)/N, f1=(pre+rec)>0?2*pre*rec/(pre+rec):0;
    var W=680,H=220,x0=30,x1=660,yb=180, lo=-4, hi=8;
    function X(v){return x0+(v-lo)/(hi-lo)*(x1-x0);}
    var mx=Math.max(Ng*pdf(0),P*pdf(0)); function Y(v){return yb-v/mx*150;}
    var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="score distributions and threshold">';
    s+='<line x1="'+x0+'" y1="'+yb+'" x2="'+x1+'" y2="'+yb+'" class="ax"/>';
    function curve(mu,scale,cls,fillFrom){
      var pts=[],area=[];
      for(var i=0;i<=240;i++){var v=lo+(hi-lo)*i/240;var y=scale*pdf(v-mu);pts.push(X(v).toFixed(1)+" "+Y(y).toFixed(1));
        if(v>=fillFrom) area.push(X(v).toFixed(1)+" "+Y(y).toFixed(1));}
      if(area.length>1) s+='<path d="M'+X(Math.max(fillFrom,lo)).toFixed(1)+' '+yb+' L'+area.join(" L")+' L'+X(hi).toFixed(1)+' '+yb+' Z" class="'+cls+'f" opacity="0.25"/>';
      s+='<path d="M'+pts.join(" L")+'" class="'+cls+'" stroke-width="2"/>';
    }
    curve(0,Ng,"tl",th); curve(d,P,"acc",th);
    s+='<line x1="'+X(th).toFixed(1)+'" y1="20" x2="'+X(th).toFixed(1)+'" y2="'+yb+'" class="ax" stroke-dasharray="5 3"/>';
    s+='<text x="'+(X(th)+5).toFixed(1)+'" y="30" class="lbl">threshold → fires</text>';
    s+='<text x="'+x0+'" y="'+(H-14)+'" class="lbl">teal: no-event windows (shaded = false alarms) · copper: event windows (shaded = detected)</text></svg>';
    $("r-plot").innerHTML=s;
    $("r-tp").textContent=Math.round(TP); $("r-fp").textContent=Math.round(FP); $("r-fn").textContent=Math.round(FN);
    $("r-rec").textContent=f(rec,2); $("r-pre").textContent=f(pre,2); $("r-acc").textContent=f(acc,3); $("r-f1").textContent=f(f1,2);
    var el=$("r-verdict"), triv=1-p;
    if(acc<=triv+1e-9){ el.className="verdict bad"; el.innerHTML="<b>Accuracy "+f(acc,3)+" is no better than always answering “no event” ("+f(triv,3)+").</b> With rare events, accuracy rewards doing nothing; judge the detector by precision and recall instead."; }
    else if(pre<0.5){ el.className="verdict bad"; el.innerHTML="<b>Most alarms are false</b> (precision "+f(pre,2)+"). Fine for an always-on first stage whose alarms are re-checked by a bigger model; unacceptable if a person is woken up for each one."; }
    else { el.className="verdict"; el.innerHTML="<b>Recall "+f(rec,2)+", precision "+f(pre,2)+".</b> Now lower the prevalence to 1 % without moving anything else and watch precision fall: the classifier did not change, the world did."; }
  }
  ["r-p","r-d","r-t"].forEach(function(i){$(i).addEventListener("input",run);});
  run();
})();


/* ---------- site chrome: theme, menu, toc highlight ---------- */
(function(){
  var root=document.documentElement;
  var btn=document.querySelector(".themebtn");
  function current(){
    var t=root.getAttribute("data-theme");
    if(t) return t;
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  if(btn){
    btn.addEventListener("click",function(){
      var next=current()==="dark"?"light":"dark";
      root.setAttribute("data-theme",next);
      try{localStorage.setItem("eml-theme",next);}catch(e){}
    });
  }
  var mb=document.querySelector(".menubtn"), nav=document.getElementById("topnav");
  if(mb&&nav){
    mb.addEventListener("click",function(){
      var o=nav.classList.toggle("open"); mb.setAttribute("aria-expanded",o?"true":"false");
    });
  }
  // collapse the "on this page" box by default on small screens
  var det=document.querySelector("nav.toc details");
  if(det && window.matchMedia && window.matchMedia("(max-width:960px)").matches){ det.removeAttribute("open"); }
  // highlight current section in the sidebar
  var links=[].slice.call(document.querySelectorAll("nav.toc ol.sec a"));
  if(links.length && "IntersectionObserver" in window){
    var map={}; links.forEach(function(a){ map[a.getAttribute("href").slice(1)]=a; });
    var obs=new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(e.isIntersecting){ links.forEach(function(a){a.classList.remove("active");}); var a=map[e.target.id]; if(a) a.classList.add("active"); }
      });
    },{rootMargin:"-60px 0px -70% 0px"});
    Object.keys(map).forEach(function(id){ var h=document.getElementById(id); if(h) obs.observe(h); });
  }
})();

/* ---------- photo credits from assets/img/credits.json (written by fetch_images.py) ---------- */
(function(){
  var els=document.querySelectorAll("[data-img]");
  if(!els.length || !window.fetch) return;
  fetch("assets/img/credits.json").then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(list){
    var by={}; list.forEach(function(e){ by[e.file]=e; });
    function esc(t){ var d=document.createElement("span"); d.textContent=t||""; return d.innerHTML; }
    [].forEach.call(els,function(el){
      var e=by[el.getAttribute("data-img")]; if(!e) return;
      var lic=e.license_url?'<a href="'+esc(e.license_url)+'">'+esc(e.license)+'</a>':esc(e.license);
      if(el.tagName==="TR"){
        el.querySelector(".c-src").innerHTML='<a href="'+esc(e.page)+'">'+esc(e.title)+'</a>'+(e.author?' — '+esc(e.author):'');
        el.querySelector(".c-lic").innerHTML=lic;
      } else {
        el.innerHTML='Photo: '+(e.author?esc(e.author)+', ':'')+'<a href="'+esc(e.page)+'">Wikimedia Commons</a>, '+lic;
      }
    });
  }).catch(function(){});
})();
