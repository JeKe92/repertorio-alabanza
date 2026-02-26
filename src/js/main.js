const SHEET_ID = '1anYCamlSRFhbbQAJVATmPcaG-jajkqWJREAyd5y3ERU';
const TAB = 'ProgMes';
let songs = [];

// Column mapping (confirmed via console debug on hoja Marzo):
// 0 = Mes (ignore)
// 1 = Fecha Date(2026,2,1) - month is 0-based, correct!
// 2 = FechaText (Date object too, ignore)
// 3 = Coro dropdown (ignore)
// 4 = CoroText - use this for name
// 5 = Tonalidad A
// 6 = Tonalidad B
// 7 = Acordes URL
// 8 = YouTube URL

function parseDateText(s) {
  if (!s) return null;
  const parts = s.split('/');
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
  }
  return null;
}

function dateKey(d) {
  if (!d) return 'zzzz';
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function dateLabel(d) {
  if (!d) return 'Sin fecha';
  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return days[d.getDay()] + ' ' + d.getDate() + ' de ' + months[d.getMonth()] + ' de ' + d.getFullYear();
}

function extractKey(s) {
  if (!s) return '';
  const p = s.match(/\(([A-G][b#]?m?)\)\s*$/);
  if (p) return p[1];
  if (/^[A-G][b#]?m?$/.test(s.trim())) return s.trim();
  return s.trim();
}

function isUrl(s) {
  if (!s) return false;
  const t = s.trim();
  return t.startsWith('http://') || t.startsWith('https://') || t.startsWith('www.');
}

// Theme toggle logic
const THEME_KEY = 'repertorio_theme';

function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.add('light');
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.body.classList.remove('light');
    }
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.textContent = (theme === 'light') ? '🌙' : '☀️';
        btn.title = (theme === 'light') ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
    }
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
}

function toggleTheme() {
    const current = document.body.classList.contains('light') ? 'light' : 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light');
}

function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    if (!saved) {
        saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    applyTheme(saved);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggleTheme);
}

// initialize theme before loading data
initTheme();

async function load() {
  document.getElementById('main').innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
  try {
    const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&sheet=' + encodeURIComponent(TAB);
    const r = await fetch(url);
    const t = await r.text();
    const j = JSON.parse(t.slice(47, -2));
    const rows = j.table.rows;

    // DEBUG: log first row columns
    if (rows[0]) { rows[0].c.forEach(function(c,i){ console.log('col['+i+']:', c ? String(c.v).substring(0,60) : 'NULL'); }); }

    songs = rows
      .filter(function(r) { return r.c[4] && r.c[4].v && !String(r.c[4].v).startsWith('http'); })
      .map(function(r) {
        var g = function(i) { return (r.c[i] && r.c[i].v != null) ? String(r.c[i].v).trim() : ''; };
        // Parse date from col[1] - month is already 0-based in this sheet
        var dateRaw = (r.c[1] && r.c[1].v) ? String(r.c[1].v) : '';
        var d = null;
        if (dateRaw.startsWith('Date(')) {
          var parts = dateRaw.slice(5,-1).split(',').map(Number);
          d = new Date(parts[0], parts[1], parts[2]);
        }
        var tonBRaw = g(6);
        var acordesRaw = g(7);
        var ytRaw = g(8);
        return {
          d: d,
          dk: dateKey(d),
          dl: dateLabel(d),
          name: g(4),
          tonA: extractKey(g(5)),
          tonB: (tonBRaw && tonBRaw.toLowerCase() !== 'no encontrado') ? extractKey(tonBRaw) : '',
          acordes: isUrl(acordesRaw) ? acordesRaw : '',
          yt: isUrl(ytRaw) ? ytRaw : ''
        };
      });

    songs.sort(function(a, b) { return a.dk.localeCompare(b.dk); });

    var seen = {};
    var sel = document.getElementById('fdate');
    sel.innerHTML = '<option value="">Todas las fechas</option>';
    songs.forEach(function(s) {
      if (!seen[s.dk]) {
        seen[s.dk] = true;
        var o = document.createElement('option');
        o.value = s.dk;
        o.textContent = s.dl;
        sel.appendChild(o);
      }
    });

    document.getElementById('tagline').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-ES') + ' · ' + songs.length + ' canciones';
    render();
  } catch(e) {
    console.error(e);
    document.getElementById('main').innerHTML = '<div class="empty"><p style="font-size:1.5rem;margin-bottom:8px">⚠️</p><p>Error al cargar datos.</p><button onclick="load()" style="margin-top:14px;padding:8px 18px;border-radius:8px;border:1px solid #f87171;background:rgba(248,113,113,0.1);color:#fca5a5;cursor:pointer;font-family:inherit;">Reintentar</button></div>';
  }
}

function render() {
  var q = document.getElementById('search').value.toLowerCase().trim();
  var df = document.getElementById('fdate').value;

  var filtered = songs.filter(function(s) {
    return (!q || s.name.toLowerCase().includes(q)) && (!df || s.dk === df);
  });

  document.getElementById('stats').innerHTML =
    '<div class="chip"><b>' + filtered.length + '</b> canciones</div>' +
    (filtered.filter(function(s){return s.acordes;}).length ? '<div class="chip"><b>' + filtered.filter(function(s){return s.acordes;}).length + '</b> con acordes</div>' : '') +
    (filtered.filter(function(s){return s.yt;}).length ? '<div class="chip"><b>' + filtered.filter(function(s){return s.yt;}).length + '</b> con video</div>' : '');

  if (!filtered.length) {
    document.getElementById('main').innerHTML = '<div class="empty">🎵<br><br>No hay canciones que coincidan</div>';
    return;
  }

  var groups = {}, order = [];
  filtered.forEach(function(s) {
    if (!groups[s.dk]) { groups[s.dk] = { label: s.dl, list: [] }; order.push(s.dk); }
    groups[s.dk].list.push(s);
  });

  var iDoc = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  var iYT  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>';

  var html = '';
  order.forEach(function(dk) {
    var group = groups[dk];
    html += '<div class="date-group"><div class="date-header"><span class="date-badge">' + group.label + '</span><span class="date-count">' + group.list.length + ' canci' + (group.list.length===1?'ón':'ones') + '</span><div class="hline"></div></div>';

    group.list.forEach(function(s, i) {
      var meta = '';
      if (s.tonA) meta += '<span class="meta-label">Ton</span><span class="tone-chip">' + s.tonA + '</span>';
      if (s.tonB) meta += '<span class="dot"> · </span><span class="meta-label">Alt</span><span class="tone-alt">' + s.tonB + '</span>';

      var btnA = s.acordes ? '<a class="btn btn-acordes" href="' + s.acordes + '" target="_blank" rel="noopener">' + iDoc + ' Acordes</a>' : '';
      var btnY = s.yt      ? '<a class="btn btn-yt"      href="' + s.yt      + '" target="_blank" rel="noopener">' + iYT  + ' YouTube</a>' : '';

      html += '<div class="song-card" style="animation-delay:' + (i*0.03) + 's"><div class="song-name">' + s.name + '</div>' + (meta ? '<div class="meta-row">' + meta + '</div>' : '') + '<div class="actions">' + btnA + btnY + '</div></div>';
    });

    html += '</div>';
  });

  document.getElementById('main').innerHTML = html;
}

load();