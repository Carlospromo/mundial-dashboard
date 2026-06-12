let globalData = [];
let globalHeaders = [];
let globalAliasIdx = -1;

// Store chart instances so we can destroy them before redrawing
let charts = {
    groupMatches: null,
    groupStandings: null,
    knockout: null,
    questions: null
};

document.addEventListener('DOMContentLoaded', () => {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";
    loadData();
});

async function loadData() {
    try {
        const response = await fetch('/api/data');
        const rows = await response.json();
        
        if (!rows || rows.length < 2) return;

        globalHeaders = rows[0];
        globalData = rows.slice(1);
        
        globalAliasIdx = globalHeaders.findIndex(h => h && h.toLowerCase().includes('alias'));

        renderGlobalKPIs();
        setupDynamicSections();

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function renderGlobalKPIs() {
    const winnerIdx = globalHeaders.findIndex(h => h && h.includes('Q46'));
    const pichichiIdx = globalHeaders.findIndex(h => h && h.includes('Q36'));
    const goldenBootIdx = globalHeaders.findIndex(h => h && h.includes('Q37'));

    document.getElementById('kpi-participants').innerText = globalData.length;

    if (globalAliasIdx !== -1) {
        const latest = globalData.slice(-10).reverse().map(row => row[globalAliasIdx]);
        const listEl = document.getElementById('latest-participants');
        listEl.innerHTML = '';
        latest.forEach(alias => {
            if(alias) {
                const li = document.createElement('li');
                li.innerText = alias;
                listEl.appendChild(li);
            }
        });
    }

    if (winnerIdx !== -1) renderChart('winnerChart', null, getFrequenciesWithAliases(winnerIdx), 'doughnut', 'Ganador Mundial', 'winnerDetails');
    if (goldenBootIdx !== -1) renderChart('goldenBootChart', null, getFrequenciesWithAliases(goldenBootIdx), 'bar', 'Bota de Oro', 'goldenBootDetails');
    if (pichichiIdx !== -1) renderChart('spainScorerChart', null, getFrequenciesWithAliases(pichichiIdx), 'bar', 'Pichichi La Roja', 'spainScorerDetails');
}

function setupDynamicSections() {
    const categories = {
        groupMatches: [],
        groupStandings: [],
        knockout: [],
        questions: []
    };

    globalHeaders.forEach((header, index) => {
        if (!header) return;
        const lower = header.toLowerCase();
        
        if ((lower.includes('grupo') && lower.includes('vs')) || lower.includes('partidazo')) {
            categories.groupMatches.push({ index, label: header });
        } else if (lower.includes('º del grupo')) {
            categories.groupStandings.push({ index, label: header });
        } else if (lower.includes('partido ') && !lower.includes('grupo')) {
            categories.knockout.push({ index, label: header });
        } else if (lower.startsWith('q') && /\d/.test(lower)) {
            categories.questions.push({ index, label: header });
        }
    });

    setupSelector('groupMatchesSelect', categories.groupMatches, 'groupMatchesChart', 'groupMatches', 'pie', 'groupMatchesDetails');
    setupSelector('groupStandingsSelect', categories.groupStandings, 'groupStandingsChart', 'groupStandings', 'bar', 'groupStandingsDetails');
    setupSelector('knockoutSelect', categories.knockout, 'knockoutChart', 'knockout', 'doughnut', 'knockoutDetails');
    setupSelector('questionsSelect', categories.questions, 'questionsChart', 'questions', 'bar', 'questionsDetails');
}

function setupSelector(selectId, items, canvasId, chartKey, chartType, detailsId) {
    const selectEl = document.getElementById(selectId);
    
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.index;
        option.innerText = item.label.split('\n')[0];
        selectEl.appendChild(option);
    });

    selectEl.addEventListener('change', (e) => {
        const colIndex = parseInt(e.target.value);
        if (isNaN(colIndex)) {
            if (charts[chartKey]) {
                charts[chartKey].destroy();
                charts[chartKey] = null;
            }
            document.getElementById(detailsId).innerHTML = '';
            return;
        }

        const freqs = getFrequenciesWithAliases(colIndex);
        const label = e.target.options[e.target.selectedIndex].text;
        
        charts[chartKey] = renderChart(canvasId, charts[chartKey], freqs, chartType, label, detailsId);
    });

    if (items.length > 0) {
        selectEl.value = items[0].index;
        selectEl.dispatchEvent(new Event('change'));
    }
}

function getFrequenciesWithAliases(colIndex) {
    const groups = {};
    globalData.forEach(row => {
        let val = row[colIndex];
        let alias = (globalAliasIdx !== -1 && row[globalAliasIdx]) ? row[globalAliasIdx].trim() : 'Anónimo';
        
        if (val) {
            val = val.split('\n')[0].trim();
            if (!groups[val]) groups[val] = [];
            groups[val].push(alias);
        }
    });
    
    return Object.entries(groups)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 15);
}

function renderChart(canvasId, existingChartInstance, freqData, type, label, detailsId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    if (existingChartInstance) {
        existingChartInstance.destroy();
    }

    const labels = freqData.map(d => d[0]);
    const data = freqData.map(d => d[1].length);
    
    const is1X2 = labels.every(l => ['1', 'x', '2'].includes(l.toLowerCase()));
    
    const colors = is1X2 
        ? ['#10b981', '#f59e0b', '#f43f5e'] 
        : [
            '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', 
            '#f59e0b', '#10b981', '#14b8a6', '#06b6d4',
            '#6366f1', '#a855f7'
        ];

    // Render details
    renderVotersDetails(detailsId, freqData);

    return new Chart(ctx.getContext('2d'), {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                backgroundColor: type === 'bar' ? 'rgba(59, 130, 246, 0.7)' : colors,
                borderColor: type === 'bar' ? '#3b82f6' : undefined,
                borderWidth: type === 'bar' ? 1 : 0,
                hoverOffset: type !== 'bar' ? 10 : 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: type === 'bar' ? {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0, color: '#94a3b8' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                }
            } : undefined,
            plugins: {
                legend: { 
                    display: type !== 'bar',
                    position: 'right',
                    labels: { color: '#f8fafc' }
                }
            }
        }
    });
}

function renderVotersDetails(detailsId, freqData) {
    const detailsEl = document.getElementById(detailsId);
    if (!detailsEl) return;
    
    detailsEl.innerHTML = '';
    
    freqData.forEach(item => {
        const val = item[0];
        const aliases = item[1];
        
        const block = document.createElement('div');
        block.className = 'voter-block';
        
        const title = document.createElement('h4');
        title.innerText = `${val} (${aliases.length} votos)`;
        
        const aliasList = document.createElement('p');
        aliasList.innerText = aliases.join(', ');
        
        block.appendChild(title);
        block.appendChild(aliasList);
        detailsEl.appendChild(block);
    });
}

// --- Chatbot Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    
    if (chatInput && chatSendBtn) {
        chatSendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});

async function sendMessage() {
    const inputEl = document.getElementById('chatInput');
    const message = inputEl.value.trim();
    if (!message) return;

    appendMessage('user', message);
    inputEl.value = '';
    
    const loadingId = appendMessage('ai', 'Pensando...');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        const loadingEl = document.getElementById(loadingId);
        
        if (response.ok) {
            loadingEl.innerText = data.reply;
        } else {
            loadingEl.innerText = '❌ ' + (data.error || 'Error desconocido.');
        }
    } catch (err) {
        document.getElementById(loadingId).innerText = '❌ No se pudo conectar con el servidor.';
    }
}

function appendMessage(sender, text) {
    const windowEl = document.getElementById('chatWindow');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}-message`;
    msgDiv.innerText = text;
    
    // Generate a random ID for loading messages
    const id = 'msg-' + Date.now();
    msgDiv.id = id;
    
    windowEl.appendChild(msgDiv);
    windowEl.scrollTop = windowEl.scrollHeight;
    
    return id;
}
