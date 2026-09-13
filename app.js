(function(){
  "use strict";

  var STORAGE_KEY = "beranger-epargne:transactions";

  var EXPENSE_CATS = ["Logement","Alimentation","Transport","Santé","Abonnements","Loisirs","Achats","Éducation","Épargne / Investissement","Autres"];
  var INCOME_CATS = ["Salaire","Freelance","Rendement / Placement","Cadeau","Autre revenu"];
  var SAVINGS_CAT = "Épargne / Investissement";
  var CAT_COLOR_VARS = {
    "Logement": "--cat-logement",
    "Alimentation": "--cat-alimentation",
    "Transport": "--cat-transport",
    "Santé": "--cat-sante",
    "Abonnements": "--cat-abonnements",
    "Loisirs": "--cat-loisirs",
    "Achats": "--cat-achats",
    "Éducation": "--cat-education"
  };

  var fmtMoney = new Intl.NumberFormat('fr-CA', { style:'currency', currency:'CAD', maximumFractionDigits:2 });

  function money(n){ return fmtMoney.format(n||0); }
  function pct(n){ return (n>=0?"+":"") + Math.round(n*100) + "%"; }
  function monthKey(d){ return d.slice(0,7); }
  function todayISO(){ var d=new Date(); return d.toISOString().slice(0,10); }
  function uid(){ return (crypto && crypto.randomUUID) ? crypto.randomUUID() : ("tx-" + Date.now() + "-" + Math.random().toString(36).slice(2)); }
  function shiftMonthKey(key, delta){
    var parts = key.split("-").map(Number);
    var d = new Date(parts[0], parts[1]-1+delta, 1);
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
  }
  function monthLabel(key){
    var parts = key.split("-").map(Number);
    var d = new Date(parts[0], parts[1]-1, 2);
    var s = new Intl.DateTimeFormat('fr-CA', { month:'long', year:'numeric' }).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function monthShort(key){
    var parts = key.split("-").map(Number);
    var d = new Date(parts[0], parts[1]-1, 2);
    var s = new Intl.DateTimeFormat('fr-CA', { month:'short' }).format(d);
    return s.replace(".","");
  }
  function dayLabel(iso){
    var d = new Date(iso+"T00:00:00");
    var s = new Intl.DateTimeFormat('fr-CA', { weekday:'long', day:'numeric', month:'long' }).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function escapeHtml(s){
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // ---- persistence (local to this browser/device) ----
  function loadTx(){
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e){
      console.error("Lecture du registre impossible", e);
      return [];
    }
  }
  function saveTx(list){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch(e){
      console.error("Écriture du registre impossible", e);
      alert("Impossible d'enregistrer : le stockage de cet appareil est peut-être plein. Exportez une copie de sauvegarde puis libérez de l'espace.");
      return false;
    }
  }

  var state = {
    allTx: loadTx(),
    currentMonth: monthKey(todayISO()),
    formType: "expense",
    editingId: null
  };

  // ---- theme (light/dark/auto), CSS already defines the variables ----
  var THEME_KEY = "beranger-epargne:theme";
  var THEME_LABELS = { system: "Thème : auto", light: "Thème : clair", dark: "Thème : sombre" };
  function currentTheme(){
    var t = localStorage.getItem(THEME_KEY);
    return (t === "light" || t === "dark") ? t : "system";
  }
  function applyTheme(t){
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
    document.getElementById("themeToggle").textContent = THEME_LABELS[t];
  }
  applyTheme(currentTheme());
  document.getElementById("themeToggle").addEventListener("click", function(){
    var order = ["system","light","dark"];
    var next = order[(order.indexOf(currentTheme())+1) % order.length];
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  function populateCategorySelect(){
    var sel = document.getElementById("fCategory");
    var list = state.formType === "income" ? INCOME_CATS : EXPENSE_CATS;
    sel.innerHTML = list.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join("");
  }

  document.getElementById("fDate").value = todayISO();
  populateCategorySelect();

  document.getElementById("btnExpense").addEventListener("click", function(){ setFormType("expense"); });
  document.getElementById("btnIncome").addEventListener("click", function(){ setFormType("income"); });
  function setFormType(t){
    state.formType = t;
    var bExp = document.getElementById("btnExpense"), bInc = document.getElementById("btnIncome");
    bExp.classList.toggle("active", t==="expense");
    bExp.setAttribute("aria-pressed", t==="expense" ? "true" : "false");
    bInc.classList.toggle("active", t==="income");
    bInc.setAttribute("aria-pressed", t==="income" ? "true" : "false");
    populateCategorySelect();
  }

  document.getElementById("prevMonth").addEventListener("click", function(){
    state.currentMonth = shiftMonthKey(state.currentMonth, -1);
    render();
  });
  document.getElementById("nextMonth").addEventListener("click", function(){
    state.currentMonth = shiftMonthKey(state.currentMonth, 1);
    render();
  });
  document.getElementById("gotoToday").addEventListener("click", function(){
    state.currentMonth = monthKey(todayISO());
    render();
  });

  document.getElementById("addForm").addEventListener("submit", function(e){
    e.preventDefault();
    var amount = parseFloat(document.getElementById("fAmount").value);
    if (!amount || amount <= 0) return;
    var date = document.getElementById("fDate").value || todayISO();
    var category = document.getElementById("fCategory").value;
    var note = document.getElementById("fNote").value.trim();

    if (state.editingId){
      var existing = state.allTx.find(function(t){ return t.id === state.editingId; });
      if (existing){
        existing.type = state.formType;
        existing.amount = Math.round(amount*100)/100;
        existing.category = category;
        existing.note = note;
        existing.date = date;
      }
    } else {
      var tx = {
        id: uid(),
        type: state.formType,
        amount: Math.round(amount*100)/100,
        category: category,
        note: note,
        date: date,
        createdAt: new Date().toISOString()
      };
      state.allTx.push(tx);
    }
    saveTx(state.allTx);
    stopEditing();
    render();
  });

  document.getElementById("cancelEditBtn").addEventListener("click", function(){
    stopEditing();
  });

  function startEdit(id){
    var t = state.allTx.find(function(x){ return x.id === id; });
    if (!t) return;
    state.editingId = id;
    setFormType(t.type);
    document.getElementById("fAmount").value = t.amount;
    document.getElementById("fCategory").value = t.category;
    document.getElementById("fNote").value = t.note || "";
    document.getElementById("fDate").value = t.date;
    document.getElementById("submitBtn").textContent = "Enregistrer";
    document.getElementById("cancelEditBtn").hidden = false;
    document.getElementById("addForm").scrollIntoView({ behavior:"smooth", block:"nearest" });
    document.getElementById("fAmount").focus();
    renderLedgerHighlight();
  }

  function stopEditing(){
    state.editingId = null;
    document.getElementById("addForm").reset();
    document.getElementById("fDate").value = todayISO();
    setFormType("expense");
    document.getElementById("submitBtn").textContent = "Ajouter";
    document.getElementById("cancelEditBtn").hidden = true;
  }

  function renderLedgerHighlight(){
    document.querySelectorAll("#ledgerList .row").forEach(function(row){
      row.classList.toggle("editing", row.getAttribute("data-id") === state.editingId);
    });
  }

  function deleteTx(id){
    var t = state.allTx.find(function(x){ return x.id === id; });
    var label = t ? ((t.note || t.category) + " — " + money(t.amount)) : "cette opération";
    if (!confirm("Supprimer " + label + " ? Cette action est irréversible.")) return;
    state.allTx = state.allTx.filter(function(x){ return x.id !== id; });
    if (state.editingId === id) stopEditing();
    saveTx(state.allTx);
    render();
  }

  // ---- export / import ----
  document.getElementById("exportBtn").addEventListener("click", function(){
    var blob = new Blob([JSON.stringify(state.allTx, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var stamp = todayISO();
    a.href = url;
    a.download = "beranger-epargne-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  document.getElementById("importBtn").addEventListener("click", function(){
    document.getElementById("importFile").click();
  });
  document.getElementById("importFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      try {
        var incoming = JSON.parse(reader.result);
        if (!Array.isArray(incoming)) throw new Error("format inattendu");
        var existingIds = new Set(state.allTx.map(function(t){ return t.id; }));
        var added = 0;
        incoming.forEach(function(t){
          if (t && t.id && !existingIds.has(t.id) && typeof t.amount === "number" && t.date){
            state.allTx.push(t);
            existingIds.add(t.id);
            added++;
          }
        });
        saveTx(state.allTx);
        render();
        alert(added + " opération(s) importée(s).");
      } catch(err){
        alert("Ce fichier ne ressemble pas à une sauvegarde valide de Béranger Épargne.");
      }
      document.getElementById("importFile").value = "";
    };
    reader.readAsText(file);
  });

  function txForMonth(key){
    return state.allTx.filter(function(t){ return monthKey(t.date) === key; });
  }

  function summarize(txs){
    var income = 0, expense = 0, savings = 0;
    var byCat = {};
    txs.forEach(function(t){
      if (t.type === "income"){
        income += t.amount;
      } else {
        if (t.category === SAVINGS_CAT){ savings += t.amount; }
        else { expense += t.amount; byCat[t.category] = (byCat[t.category]||0) + t.amount; }
      }
    });
    return { income:income, expense:expense, savings:savings, byCat:byCat, leftover: income - expense - savings };
  }

  function render(){
    document.getElementById("monthLabel").textContent = monthLabel(state.currentMonth);

    var monthTx = txForMonth(state.currentMonth);
    var prevKey = shiftMonthKey(state.currentMonth, -1);
    var prevTx = txForMonth(prevKey);
    var cur = summarize(monthTx);
    var prev = summarize(prevTx);

    document.getElementById("tileIn").textContent = money(cur.income);
    document.getElementById("tileOut").textContent = money(cur.expense);
    document.getElementById("tileSave").textContent = money(cur.savings);
    var leftEl = document.getElementById("tileLeft");
    leftEl.textContent = money(cur.leftover);
    leftEl.classList.toggle("neg", cur.leftover < 0);

    document.getElementById("tileInSub").textContent = prev.income ? pct((cur.income-prev.income)/prev.income) + " vs mois précédent" : "";
    document.getElementById("tileOutSub").textContent = prev.expense ? pct((cur.expense-prev.expense)/prev.expense) + " vs mois précédent" : "";
    document.getElementById("tileSaveSub").textContent = cur.income ? Math.round((cur.savings/cur.income)*100) + "% des entrées" : "";
    document.getElementById("tileLeftSub").textContent = cur.leftover > 0 ? "à assigner à l'épargne" : (cur.leftover < 0 ? "dépassement ce mois-ci" : "");

    document.getElementById("txCount").textContent = monthTx.length + (monthTx.length>1 ? " opérations" : " opération");

    renderLedger(monthTx);
    renderReport(cur, prev, prevKey, monthTx);
    renderCategoryBars(cur.byCat, cur.expense);
    renderTrend();
    renderSuggestions(cur, prev, monthTx, prevTx);
  }

  function renderLedger(monthTx){
    var el = document.getElementById("ledgerList");
    if (!monthTx.length){
      el.innerHTML = '<div class="empty">Aucune opération pour ce mois. Ajoutez votre première entrée ou sortie ci-dessus.</div>';
      return;
    }
    var sorted = monthTx.slice().sort(function(a,b){
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt||"").localeCompare(a.createdAt||"");
    });
    var groups = [];
    var lastDate = null;
    sorted.forEach(function(t){
      if (t.date !== lastDate){ groups.push({date:t.date, items:[]}); lastDate = t.date; }
      groups[groups.length-1].items.push(t);
    });
    el.innerHTML = groups.map(function(g){
      var rows = g.items.map(function(t){
        var cls = t.type === "income" ? "in" : (t.category === SAVINGS_CAT ? "save" : "out");
        var sign = t.type === "income" ? "+" : "−";
        var label = t.note ? escapeHtml(t.note) : escapeHtml(t.category);
        return '<div class="row" data-id="'+t.id+'">'
          + '<div class="desc">'
          +   '<span class="note" title="'+label+'">'+ label +'</span>'
          +   '<span class="pill" style="color:'+catColor(t)+'"><span class="dot"></span>'+escapeHtml(t.category)+'</span>'
          + '</div>'
          + '<span class="amt num '+cls+'">'+sign+' '+money(t.amount)+'</span>'
          + '<button class="del" data-id="'+t.id+'" aria-label="Supprimer">✕</button>'
          + '</div>';
      }).join("");
      return '<div class="day-group"><div class="day-head">'+dayLabel(g.date)+'</div>'+rows+'</div>';
    }).join("");
    el.querySelectorAll(".del").forEach(function(btn){
      btn.addEventListener("click", function(e){
        e.stopPropagation();
        deleteTx(btn.getAttribute("data-id"));
      });
    });
    el.querySelectorAll(".row").forEach(function(row){
      row.addEventListener("click", function(e){
        if (e.target.closest(".del")) return;
        startEdit(row.getAttribute("data-id"));
      });
    });
    renderLedgerHighlight();
  }

  function catColor(t){
    if (t.type === "income") return "var(--ledger)";
    if (t.category === SAVINGS_CAT) return "var(--brass)";
    var v = CAT_COLOR_VARS[t.category];
    return v ? "var("+v+")" : "var(--muted)";
  }

  function topCategory(byCat){
    var best = null;
    Object.keys(byCat).forEach(function(c){
      if (!best || byCat[c] > byCat[best]) best = c;
    });
    return best;
  }

  function renderReport(cur, prev, prevKey, monthTx){
    var el = document.getElementById("reportBody");
    if (!monthTx.length){
      el.innerHTML = '<div class="empty" style="padding:6px 0;">Le rapport se remplira dès la première opération saisie ce mois-ci.</div>';
      return;
    }
    var top = topCategory(cur.byCat);
    var topShare = top && cur.expense ? Math.round((cur.byCat[top]/cur.expense)*100) : 0;

    var lines = "";
    lines += reportLine("Entrées", money(cur.income), prev.income ? (cur.income-prev.income)/prev.income : null);
    lines += reportLine("Sorties courantes", money(cur.expense), prev.expense ? (cur.expense-prev.expense)/prev.expense : null);
    lines += reportLine("Épargne", money(cur.savings), prev.savings ? (cur.savings-prev.savings)/prev.savings : null);
    if (top) lines += reportLine("Plus grosse catégorie", top + " · " + topShare + "%", null);

    var note = "Ce mois-ci, "+ (cur.leftover>=0 ? "il vous reste " + money(cur.leftover) + " non assigné après vos sorties et votre épargne." : "vos sorties et votre épargne dépassent vos entrées de " + money(Math.abs(cur.leftover)) + ".");
    if (prev.income || prev.expense){
      note += " Comparé à " + monthLabel(prevKey).split(" ")[0] + ", ";
      var parts = [];
      if (prev.income) parts.push("les entrées ont " + (cur.income>=prev.income?"augmenté":"diminué") + " de " + Math.abs(Math.round(((cur.income-prev.income)/prev.income)*100)) + "%");
      if (prev.expense) parts.push("les sorties ont " + (cur.expense>=prev.expense?"augmenté":"diminué") + " de " + Math.abs(Math.round(((cur.expense-prev.expense)/prev.expense)*100)) + "%");
      note += parts.join(" et ") + ".";
    }

    el.innerHTML = lines + '<div class="report-note">'+note+'</div>';
  }

  function reportLine(label, value, delta){
    var d = "";
    if (delta !== null && isFinite(delta)){
      d = '<span class="delta '+(delta>=0?"up":"down")+'">'+pct(delta)+'</span>';
    }
    return '<div class="report-line"><span class="lbl">'+label+'</span><span class="num">'+value+d+'</span></div>';
  }

  function renderCategoryBars(byCat, total){
    var el = document.getElementById("categoryBars");
    var cats = Object.keys(byCat).sort(function(a,b){ return byCat[b]-byCat[a]; });
    if (!cats.length){
      el.innerHTML = '<div class="empty" style="padding:6px 0;">Aucune sortie catégorisée pour l\'instant.</div>';
      return;
    }
    var max = byCat[cats[0]];
    el.innerHTML = cats.map(function(c){
      var w = Math.max(4, Math.round((byCat[c]/max)*100));
      var v = CAT_COLOR_VARS[c];
      var color = v ? "var("+v+")" : "var(--muted)";
      return '<div class="bar-row">'
        + '<div class="bar-top"><span class="cat">'+escapeHtml(c)+'</span><span class="amt num">'+money(byCat[c])+'</span></div>'
        + '<div class="bar-track"><div class="bar-fill" style="width:'+w+'%; background:'+color+'"></div></div>'
        + '</div>';
    }).join("");
  }

  function renderTrend(){
    var el = document.getElementById("trendStrip");
    var months = [];
    for (var i=5; i>=0; i--) months.push(shiftMonthKey(state.currentMonth, -i));
    var sums = months.map(function(k){
      var s = summarize(txForMonth(k));
      return { key:k, net: s.income - s.expense - s.savings };
    });
    var max = Math.max(1, Math.max.apply(null, sums.map(function(s){ return Math.abs(s.net); })));
    el.innerHTML = sums.map(function(s){
      var h = Math.max(3, Math.round((Math.abs(s.net)/max)*44));
      var cls = s.net > 0 ? "pos" : (s.net < 0 ? "neg" : "");
      var isCur = s.key === state.currentMonth;
      var label = monthLabel(s.key) + " : " + money(s.net);
      return '<div class="bar'+(isCur?' current':'')+'" tabindex="0" role="button" aria-label="'+label+'">'
        + '<span class="val">'+money(s.net)+'</span>'
        + '<div class="stick '+cls+'" style="height:'+h+'px"></div>'
        + '<div class="m">'+monthShort(s.key)+'</div></div>';
    }).join("");
    el.querySelectorAll(".bar").forEach(function(b){
      b.addEventListener("click", function(){
        var was = b.classList.contains("show");
        el.querySelectorAll(".bar").forEach(function(x){ x.classList.remove("show"); });
        b.classList.toggle("show", !was);
      });
      b.addEventListener("keydown", function(e){
        if (e.key === "Enter" || e.key === " "){ e.preventDefault(); b.click(); }
      });
    });
  }

  function renderSuggestions(cur, prev, monthTx, prevTx){
    var el = document.getElementById("suggestions");
    var tips = [];

    if (!monthTx.length){
      el.innerHTML = '<div class="empty" style="padding:6px 0;">Ajoutez quelques opérations pour recevoir des suggestions personnalisées.</div>';
      return;
    }

    if (cur.income > 0){
      var rate = (cur.income - cur.expense) / cur.income;
      if (rate < 0){
        tips.push(["critique", "Vos sorties dépassent vos entrées de "+money(Math.abs(cur.income-cur.expense))+" ce mois-ci. Passez en revue le registre pour repérer ce qui peut attendre le mois prochain."]);
      } else if (rate < 0.10){
        tips.push(["attention", "Votre taux d'épargne potentiel est de "+Math.round(rate*100)+"%. Viser 10 à 20% de vos entrées mises de côté chaque mois est un bon premier palier (règle du 50/30/20)."]);
      } else if (rate < 0.20){
        tips.push(["info", "Vous dégagez "+Math.round(rate*100)+"% de vos entrées avant épargne. Encore un petit effort pour atteindre la cible classique de 20%."]);
      } else {
        tips.push(["positif", "Vous dégagez "+Math.round(rate*100)+"% de vos entrées ce mois-ci. Assurez-vous que ce surplus est bien transféré en épargne plutôt que dépensé en fin de mois."]);
      }
    }

    if (cur.leftover > 1){
      tips.push(["attention", money(cur.leftover)+" n'est encore assigné à aucune catégorie d'épargne. Enregistrez ce montant en \""+SAVINGS_CAT+"\" pour qu'il fasse vraiment grossir votre capital plutôt que de se diluer dans les dépenses courantes."]);
    }

    var top = topCategory(cur.byCat);
    if (top && cur.expense > 0){
      var share = cur.byCat[top] / cur.expense;
      if (share > 0.35){
        var advice = "Repérez les dépenses évitables ou reportables dans cette catégorie.";
        if (top === "Abonnements") advice = "Listez vos abonnements actifs : beaucoup de gens paient pour au moins un service qu'ils n'utilisent plus.";
        if (top === "Alimentation") advice = "Comparer les circulaires ou cuisiner davantage à la maison peut réduire ce poste sans changer votre mode de vie.";
        if (top === "Loisirs") advice = "Aucun besoin de tout couper : repérez une ou deux sorties du mois prochain à espacer.";
        tips.push(["info", top+" représente "+Math.round(share*100)+"% de vos sorties courantes ce mois-ci — c'est votre plus gros poste. "+advice]);
      }
    }

    Object.keys(cur.byCat).forEach(function(c){
      var before = prev.byCat[c];
      if (before && before > 5){
        var delta = (cur.byCat[c]-before)/before;
        if (delta > 0.20){
          tips.push(["attention", "La catégorie "+c+" a augmenté de "+Math.round(delta*100)+"% par rapport au mois dernier ("+money(before)+" → "+money(cur.byCat[c])+")."]);
        }
      }
    });

    var last3 = [0,1,2].map(function(i){ return summarize(txForMonth(shiftMonthKey(state.currentMonth, -i))); });
    var subsPersisted = last3.every(function(s){ return (s.byCat["Abonnements"]||0) > 0; });
    if (subsPersisted && last3[0].byCat["Abonnements"] > 0){
      tips.push(["info", "Des frais d'abonnement reviennent depuis au moins 3 mois ("+money(last3[0].byCat["Abonnements"])+" ce mois-ci). Une révision annuelle de ces services suffit souvent à dégager quelques dollars de plus par mois, sans rien sacrifier."]);
    }

    if (!tips.length){
      tips.push(["positif", "Rien d'alarmant à signaler ce mois-ci : votre registre est équilibré."]);
    }

    el.innerHTML = tips.slice(0,6).map(function(t){
      return '<div class="tip"><span class="dot '+t[0]+'"></span><p>'+t[1]+'</p></div>';
    }).join("");
  }

  // ---- installable PWA ----
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function(e){
    e.preventDefault();
    deferredPrompt = e;
    if (!localStorage.getItem("beranger-epargne:install-dismissed")){
      document.getElementById("installBanner").classList.add("show");
    }
  });
  document.getElementById("installBtn").addEventListener("click", function(){
    document.getElementById("installBanner").classList.remove("show");
    if (deferredPrompt) deferredPrompt.prompt();
  });
  document.getElementById("dismissInstall").addEventListener("click", function(){
    document.getElementById("installBanner").classList.remove("show");
    localStorage.setItem("beranger-epargne:install-dismissed", "1");
  });

  if ("serviceWorker" in navigator){
    window.addEventListener("load", function(){
      navigator.serviceWorker.register("service-worker.js").catch(function(err){
        console.error("Échec de l'enregistrement du service worker", err);
      });
    });
  }

  render();
})();
