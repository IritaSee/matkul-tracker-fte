// Prodi picker: tambah entri di sini untuk daftar prodi baru.
const PRODI_LIST = [
  { file: 'teknik-komputer.json', label: 'S1 Teknik Komputer' },
  { file: 'teknik-biomedis.json', label: 'S1 Teknik Biomedis' }
];

(function initTheme() {
  const saved = localStorage.getItem('matkul_theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
})();

document.addEventListener('DOMContentLoaded', () => {
  const btnTheme = document.getElementById('btn-theme');
  function syncThemeLabel() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (btnTheme) btnTheme.textContent = isDark ? '☀️ Mode Terang' : '🌙 Mode Gelap';
  }
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('matkul_theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('matkul_theme', 'dark');
      }
      syncThemeLabel();
    });
  }
  syncThemeLabel();

  const gradeValues = { 'A': 4.0, 'AB': 3.5, 'B': 3.0, 'BC': 2.5, 'C': 2.0, 'D': 1.0, 'E': 0.0 };
  let userGrades = {};
  let plannedCourses = {};
  let activeModalKode = null;
  let kurikulum = [];
  let totalSks = 144;
  let activeProdiFile = localStorage.getItem('matkul_active_prodi') || PRODI_LIST[0].file;

  const kurikulumView = document.getElementById('kurikulum-view');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const prodiPicker = document.getElementById('prodi-picker');
  const btnReset = document.getElementById('btn-reset');

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (!confirm('Hapus semua nilai dan rencana SKS yang sudah diinput untuk prodi ini?')) return;
      userGrades = {};
      plannedCourses = {};
      localStorage.removeItem(storageKey('grades'));
      localStorage.removeItem(storageKey('plans'));
      renderAll();
    });
  }

  if (prodiPicker) {
    prodiPicker.innerHTML = PRODI_LIST.map(p =>
      '<option value="' + p.file + '">' + p.label + '</option>').join('');
    prodiPicker.value = activeProdiFile;
    prodiPicker.addEventListener('change', () => loadProdi(prodiPicker.value));
  }

  function storageKey(suffix) {
    return 'matkul_' + suffix + '_' + activeProdiFile;
  }

  function loadProdi(file) {
    activeProdiFile = file;
    localStorage.setItem('matkul_active_prodi', file);
    userGrades = JSON.parse(localStorage.getItem(storageKey('grades')) || '{}');
    plannedCourses = JSON.parse(localStorage.getItem(storageKey('plans')) || '{}');

    fetch('data/' + file)
      .then(res => {
        if (!res.ok) throw new Error('Gagal memuat data kurikulum: ' + res.status);
        return res.json();
      })
      .then(data => {
        kurikulum = data.semesters || [];
        totalSks = data.totalSks || 144;
        if (kurikulumView) renderAll();
      })
      .catch(err => {
        console.error(err);
        if (kurikulumView) kurikulumView.innerHTML = '<p style="color:var(--danger)">Gagal memuat data kurikulum.</p>';
      });
  }

  loadProdi(activeProdiFile);

  window.setNilai = function(grade) {
    if (!activeModalKode) return;
    if (grade === null) delete userGrades[activeModalKode];
    else userGrades[activeModalKode] = grade;
    localStorage.setItem(storageKey('grades'), JSON.stringify(userGrades));
    closeModal();
    renderAll();
  };

  window.closeModal = function() {
    if (modal) modal.style.display = 'none';
    activeModalKode = null;
  };

  function openModal(mk) {
    activeModalKode = mk.kode;
    if (modalTitle) modalTitle.textContent = 'Pilih Nilai: ' + mk.kode + ' - ' + mk.nama;
    if (modal) modal.style.display = 'flex';
  }

  function getPassedSet() {
    const passed = new Set();
    kurikulum.flat().forEach(mk => {
      const g = userGrades[mk.kode];
      if (g && gradeValues[g] >= 2.0) passed.add(mk.kode);
    });
    return passed;
  }

  function renderKurikulum() {
    if (!kurikulumView) return;
    kurikulumView.innerHTML = '';
    const passedSet = getPassedSet();

    kurikulum.forEach((semList, index) => {
      const semNo = index + 1;
      const row = document.createElement('div');
      row.className = 'sem-row';

      const label = document.createElement('div');
      label.className = 'sem-label';
      label.textContent = 'Semester ' + semNo;
      row.appendChild(label);

      semList.forEach(mk => {
        const node = document.createElement('div');
        node.className = 'mk-node rumpun-' + mk.rumpun;
        node.dataset.kode = mk.kode;

        let terkunci = false;
        if (mk.prasyarat && mk.prasyarat.length > 0) {
          terkunci = !mk.prasyarat.every(p => passedSet.has(p));
        }

        if (terkunci) node.classList.add('terkunci');

        const grade = userGrades[mk.kode];
        if (grade) {
          if (gradeValues[grade] >= 2.0) node.classList.add('lulus');
          else node.classList.add('ulang');
        }

        if (plannedCourses[mk.kode]) node.classList.add('selected-plan');

        let badgeHtml = grade ? '<div class="badge-nilai ' + grade + '">' + grade + '</div>' : '';

        node.innerHTML = badgeHtml +
          '<div class="nama" title="' + mk.nama + '">' + mk.nama + '</div>' +
          '<div class="meta">' + mk.kode + ' &bull; ' + mk.sks + ' SKS</div>';

        node.addEventListener('mouseenter', () => highlightEdges(mk.kode));
        node.addEventListener('mouseleave', clearEdgeHighlight);

        node.addEventListener('click', (e) => {
          if (e.shiftKey) {
            if (terkunci) return;
            plannedCourses[mk.kode] = !plannedCourses[mk.kode];
            if (!plannedCourses[mk.kode]) delete plannedCourses[mk.kode];
            localStorage.setItem(storageKey('plans'), JSON.stringify(plannedCourses));
            renderAll();
          } else {
            if (terkunci && !grade) return;
            openModal(mk);
          }
        });

        row.appendChild(node);
      });

      kurikulumView.appendChild(row);
    });

    drawEdges();
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function drawEdges() {
    if (!kurikulumView) return;
    kurikulumView.querySelector('svg.edges')?.remove();

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'edges');
    svg.innerHTML = '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"></path></marker></defs>';

    const containerRect = kurikulumView.getBoundingClientRect();
    svg.setAttribute('width', kurikulumView.scrollWidth);
    svg.setAttribute('height', kurikulumView.scrollHeight);

    kurikulum.flat().forEach(mk => {
      if (!mk.prasyarat || mk.prasyarat.length === 0) return;
      const toEl = kurikulumView.querySelector('[data-kode="' + mk.kode + '"]');
      if (!toEl) return;
      const toRect = toEl.getBoundingClientRect();
      const toX = toRect.left - containerRect.left + toRect.width / 2;

      mk.prasyarat.forEach(pKode => {
        const fromEl = kurikulumView.querySelector('[data-kode="' + pKode + '"]');
        if (!fromEl) return;
        const fromRect = fromEl.getBoundingClientRect();
        const fromX = fromRect.left - containerRect.left + fromRect.width / 2;
        const fromY = fromRect.top - containerRect.top + fromRect.height / 2 + kurikulumView.scrollTop;
        const toYAdj = toRect.top - containerRect.top + toRect.height / 2 + kurikulumView.scrollTop;

        const midY = (fromY + toYAdj) / 2;
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', 'M ' + fromX + ' ' + fromY + ' C ' + fromX + ' ' + midY + ', ' + toX + ' ' + midY + ', ' + toX + ' ' + toYAdj);
        path.setAttribute('class', 'edge-path');
        path.dataset.from = pKode;
        path.dataset.to = mk.kode;
        path.setAttribute('marker-end', 'url(#arrow)');
        svg.appendChild(path);
      });
    });

    kurikulumView.appendChild(svg);
  }

  window.highlightEdges = function(kode) {
    const svg = kurikulumView?.querySelector('svg.edges');
    if (!svg) return;
    svg.querySelectorAll('.edge-path').forEach(p => {
      p.classList.toggle('active', p.dataset.from === kode || p.dataset.to === kode);
    });
  };

  window.clearEdgeHighlight = function() {
    const svg = kurikulumView?.querySelector('svg.edges');
    if (!svg) return;
    svg.querySelectorAll('.edge-path').forEach(p => p.classList.remove('active'));
  };

  function renderStats() {
    let totalSksLulus = 0;
    let totalPoint = 0;
    let totalSksTaken = 0;
    let totalSksPlan = 0;

    const deListEl = document.getElementById('list-de');
    if (deListEl) deListEl.innerHTML = '';
    let deCount = 0;

    kurikulum.flat().forEach(mk => {
      const g = userGrades[mk.kode];
      if (g) {
        const val = gradeValues[g];
        totalSksTaken += mk.sks;
        totalPoint += val * mk.sks;
        if (val >= 2.0) totalSksLulus += mk.sks;
        if (g === 'D' || g === 'E') {
          deCount++;
          if (deListEl) {
            const item = document.createElement('div');
            item.className = 'item-de';
            item.innerHTML = '<span><strong>' + mk.kode + '</strong> ' + mk.nama + '</span><span>' + mk.sks + ' SKS (' + g + ')</span>';
            deListEl.appendChild(item);
          }
        }
      }
      if (plannedCourses[mk.kode]) totalSksPlan += mk.sks;
    });

    const countDeEl = document.getElementById('count-de');
    if (countDeEl) countDeEl.textContent = deCount;

    const ipk = totalSksTaken > 0 ? (totalPoint / totalSksTaken).toFixed(2) : '0.00';
    const valIpkEl = document.getElementById('val-ipk');
    if (valIpkEl) valIpkEl.textContent = ipk;
    const statSksLulusEl = document.getElementById('stat-sks-lulus');
    if (statSksLulusEl) statSksLulusEl.textContent = totalSksLulus + ' / ' + totalSks;

    // Jatah SKS mengikuti IP semester TERAKHIR yang nilainya sudah diisi (bukan IPK kumulatif):
    // IP semester terakhir > 3.0 -> 24 SKS, selain itu -> 20 SKS. Semester pertama (belum ada IP) -> 24.
    let lastFilledSem = -1;
    kurikulum.forEach((semList, idx) => {
      if (semList.some(mk => userGrades[mk.kode])) lastFilledSem = idx;
    });

    let jatahSks = 24;
    if (lastFilledSem >= 0) {
      let semSksJ = 0, semPointJ = 0;
      kurikulum[lastFilledSem].forEach(mk => {
        const g = userGrades[mk.kode];
        if (g) { semSksJ += mk.sks; semPointJ += gradeValues[g] * mk.sks; }
      });
      const ipsTerakhir = semSksJ > 0 ? semPointJ / semSksJ : 0;
      jatahSks = ipsTerakhir > 3.0 ? 24 : 20;
    }

    const statJatahSksEl = document.getElementById('stat-jatah-sks');
    if (statJatahSksEl) statJatahSksEl.textContent = jatahSks;

    const planEl = document.getElementById('stat-sks-plan');
    if (planEl) {
      planEl.textContent = totalSksPlan;
      planEl.style.color = totalSksPlan > jatahSks ? 'var(--danger)' : 'var(--warning)';
    }

    const ipSemList = document.getElementById('ip-semester-list');
    if (ipSemList) {
      ipSemList.innerHTML = '';
      kurikulum.forEach((semList, idx) => {
        let semSks = 0;
        let semPoints = 0;
        semList.forEach(mk => {
          const g = userGrades[mk.kode];
          if (g) {
            semSks += mk.sks;
            semPoints += gradeValues[g] * mk.sks;
          }
        });
        const ips = semSks > 0 ? (semPoints / semSks).toFixed(2) : '-';
        const box = document.createElement('div');
        box.style.display = 'flex';
        box.style.justifyContent = 'space-between';
        box.style.background = 'rgba(0,0,0,0.2)';
        box.style.padding = '6px 10px';
        box.style.borderRadius = '6px';
        box.innerHTML = '<span>Semester ' + (idx + 1) + ' (' + semSks + ' SKS)</span><strong>IPS: ' + ips + '</strong>';
        ipSemList.appendChild(box);
      });
    }
  }

  function renderAll() {
    renderKurikulum();
    renderStats();
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawEdges, 150);
  });
});


