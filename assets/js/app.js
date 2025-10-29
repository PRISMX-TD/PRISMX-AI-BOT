// 全局变量
let equityChart = null;
let currentData = {
  accountHistory: [],
  trades: [],
  aiLogs: []
};

// 将字符串数值（可能包含$、逗号、百分号、+/- 等）规整为 Number
function normalizeNumber(input, isPercent = false) {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') return input;
  const s = String(input).replace(/[$,\s]/g, '').replace('%', '');
  const n = Number(s);
  if (isNaN(n)) return 0;
  return isPercent ? n : n; // 这里保留原单位；百分比在展示时已带%
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  initializeChart();
  
  // 恢复上次选择的标签（URL哈希优先，其次 localStorage）
  const hashTab = (location.hash || '').replace('#', '');
  let initialTab = 'trades';
  try {
    const savedTab = localStorage.getItem('activeTab');
    initialTab = hashTab || savedTab || 'trades';
  } catch (e) {
    initialTab = hashTab || 'trades';
  }
  switchTab(initialTab);

  loadData();
  setupEventListeners();
  
  // 监听地址栏哈希变更（用户手动修改时也能同步）
  window.addEventListener('hashchange', function() {
    const tab = (location.hash || '').replace('#', '') || 'trades';
    switchTab(tab);
  });

  startAutoRefresh();
});

// 设置事件监听器
function setupEventListeners() {
  // 标签页切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabId = this.dataset.tab;
      switchTab(tabId);
    });
  });
}

// 切换标签页
function switchTab(tabId) {
  // 更新按钮状态
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  
  // 更新面板显示
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.getElementById(`${tabId}-panel`).classList.add('active');

  // 记住当前选择并同步到 URL（刷新后保持）
  try {
    localStorage.setItem('activeTab', tabId);
  } catch (e) {}
  if (location.hash !== `#${tabId}`) {
    try {
      history.replaceState(null, '', `#${tabId}`);
    } catch (e) {
      location.hash = tabId;
    }
  }
}

// 初始化图表
function initializeChart() {
  const chartDom = document.getElementById('equityChart');
  equityChart = echarts.init(chartDom);
  
  const option = {
    backgroundColor: 'transparent',
    grid: {
      left: '2.5%',
      right: '2.5%',
      top: '6%',
      bottom: '6%',
      containLabel: true
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.25)'
        }
      },
      axisLabel: {
        color: '#8892b0',
        fontSize: 12
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.06)'
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.25)'
        }
      },
      axisLabel: {
        color: '#a6b1c2',
        fontSize: 12,
        formatter: function(value) {
          return '$' + value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        }
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(155, 92, 255, 0.06)'
        }
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: 'rgba(155, 92, 255, 0.5)',
      textStyle: {
        color: '#ffffff'
      },
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: 'rgba(155, 92, 255, 0.35)'
        }
      },
      formatter: function(params) {
        if (params.length === 0) return '';
        const data = params[0];
        const time = new Date(data.axisValue).toLocaleString('zh-CN');
        // ECharts 在使用 [time, value] 形式时，data.value 是一个数组
        const rawValue = Array.isArray(data.value) ? data.value[1] : data.value;
        const value = Number(rawValue) || 0;
        return `${time}<br/>账户净值: $${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    },
    series: [{
      name: '账户净值',
      type: 'line',
      data: [],
      smooth: true,
      animationDuration: 600,
      animationEasing: 'quarticOut',
      lineStyle: {
        color: '#9b5cff',
        width: 3,
        shadowBlur: 12,
        shadowColor: 'rgba(155, 92, 255, 0.35)'
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0.0, color: 'rgba(155, 92, 255, 0.35)' },
            { offset: 0.6, color: 'rgba(124, 77, 255, 0.18)' },
            { offset: 1.0, color: 'rgba(0, 0, 0, 0)' }
          ]
        }
      },
      symbol: 'none',
      emphasis: {
        focus: 'series'
      }
    }]
  };
  
  equityChart.setOption(option);
  
  // 响应式调整
  window.addEventListener('resize', function() {
    equityChart.resize();
  });
}

// 加载数据
async function loadData() {
  try {
    await Promise.all([
      loadAccountHistory(),
      loadTrades(),
      loadAILogs()
    ]);
    
    updateChart();
    updateUI();
    updateLastSyncTime();
  } catch (error) {
    console.error('加载数据失败:', error);
    showError('数据加载失败，请稍后重试');
  }
}

// 加载账户历史
async function loadAccountHistory() {
  try {
    const response = await fetch('data/account_history.json');
    if (!response.ok) throw new Error('网络错误');
    
    const data = await response.json();
    
    // 处理时间戳和数值
    if (data.timestamps && data.values && data.timestamps.length === data.values.length) {
      currentData.accountHistory = data.timestamps.map((timestamp, index) => [
        new Date(timestamp).getTime(),
        parseFloat(data.values[index]) || 0
      ]);
    } else {
      // 如果没有时间戳，使用当前时间
      currentData.accountHistory = (data.values || []).map((value, index) => [
        Date.now() - (data.values.length - 1 - index) * 60000, // 每分钟一个点
        parseFloat(value) || 0
      ]);
    }
    
    console.log('账户历史数据:', currentData.accountHistory);
  } catch (error) {
    console.error('加载账户历史失败:', error);
    currentData.accountHistory = [];
  }
}

// 加载交易记录
async function loadTrades() {
  try {
    const response = await fetch('data/trades.json');
    if (!response.ok) throw new Error('网络错误');
    
    const data = await response.json();
    const list = Array.isArray(data) ? data : [];
    // 兼容不同字段命名，规范为界面所需字段
    currentData.trades = list.map(item => ({
      symbol: item.symbol || item.pair || '--',
      side: (item.side || item.direction || '').toString().toUpperCase(),
      qty: normalizeNumber(item.qty ?? item.quantity ?? item.size ?? 0),
      entry_price: normalizeNumber(item.entry_price ?? item.entry ?? item.open_price ?? 0),
      close_price: normalizeNumber(item.close_price ?? item.exit_price ?? item.price ?? 0),
      close_time: item.close_time ?? item.timestamp ?? item.time ?? '',
      pnl: normalizeNumber(item.pnl ?? item.profit ?? 0),
      pnl_percent: normalizeNumber(item.pnl_percent ?? item.pnl_pct ?? item.roe ?? 0, true)
    }));
  } catch (error) {
    console.error('加载交易记录失败:', error);
    currentData.trades = [];
  }
}

// 加载AI日志
async function loadAILogs() {
  try {
    const response = await fetch('data/ai_logs.json');
    if (!response.ok) throw new Error('网络错误');
    
    const data = await response.json();
    const list = Array.isArray(data) ? data : [];
    // 统一字段并转换为时间戳，便于排序
    const normalized = list.map(item => {
      const t = item.time ?? item.timestamp ?? '';
      const ts = t ? new Date(t).getTime() : 0;
      return {
        time: t,
        ts,
        analysis: item.analysis ?? item.message ?? ''
      };
    });
    // 按时间倒序（最新在最上面）
    normalized.sort((a, b) => b.ts - a.ts);
    // 将相同时间的多段分析合并到同一卡片
    const grouped = [];
    for (const item of normalized) {
      if (grouped.length > 0 && grouped[grouped.length - 1].time === item.time) {
        grouped[grouped.length - 1].analysis += '\n\n' + item.analysis;
      } else {
        grouped.push({ time: item.time, analysis: item.analysis });
      }
    }
    currentData.aiLogs = grouped;
  } catch (error) {
    console.error('加载AI日志失败:', error);
    currentData.aiLogs = [];
  }
}

// 更新图表
function updateChart() {
  if (!equityChart || currentData.accountHistory.length === 0) return;
  
  // 计算Y轴范围
  const values = currentData.accountHistory.map(item => item[1]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  const padding = range * 0.1; // 10% padding
  
  // 智能计算X轴范围（时间）
  const times = currentData.accountHistory.map(item => item[0]);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const totalTimeRange = maxTime - minTime;
  
  // 根据数据量自动调整时间窗口
  let timeWindow;
  if (currentData.accountHistory.length <= 10) {
    // 数据少时，显示所有数据
    timeWindow = totalTimeRange;
  } else if (currentData.accountHistory.length <= 50) {
    // 中等数据量，显示最近12小时
    timeWindow = 12 * 60 * 60 * 1000;
  } else {
    // 数据多时，显示最近24小时
    timeWindow = 24 * 60 * 60 * 1000;
  }
  
  const actualMinTime = Math.max(minTime, maxTime - timeWindow);
  
  const lastPoint = currentData.accountHistory[currentData.accountHistory.length - 1];
  const option = {
    xAxis: {
      min: actualMinTime,
      max: maxTime + (timeWindow * 0.05) // 5% padding
    },
    yAxis: {
      min: Math.max(0, minValue - padding),
      max: maxValue + padding
    },
    series: [{
      data: currentData.accountHistory,
      markPoint: lastPoint ? {
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: {
          color: '#9b5cff',
          borderColor: '#b388ff',
          borderWidth: 0
        },
        data: [{
          coord: lastPoint,
          value: lastPoint[1],
          label: {
            show: true,
            color: '#e6f7ff',
            padding: [4, 8],
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            borderRadius: 6,
            formatter: function(p) {
              const v = Number(p.value) || 0;
              return `$${v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            }
          }
        }]
      } : undefined
    }]
  };
  
  equityChart.setOption(option);
}

// 更新UI
function updateUI() {
  updateAccountSummary();
  updateTradesList();
  updateAILogsList();
  updateStats();
}

// 更新账户摘要
function updateAccountSummary() {
  if (currentData.accountHistory.length === 0) return;
  
  const values = currentData.accountHistory.map(item => item[1]);
  const currentValue = values[values.length - 1];
  const highestValue = Math.max(...values);
  const lowestValue = Math.min(...values);
  
  document.getElementById('currentValue').textContent = '$' + currentValue.toLocaleString();
  document.getElementById('highestValue').textContent = '$' + highestValue.toLocaleString();
  document.getElementById('lowestValue').textContent = '$' + lowestValue.toLocaleString();
}

// 更新交易列表
function updateTradesList() {
  const container = document.getElementById('tradesContainer');
  const countElement = document.getElementById('tradesCount');
  
  countElement.textContent = currentData.trades.length;
  
  if (currentData.trades.length === 0) {
    container.innerHTML = '<div class="empty">暂无交易记录</div>';
    return;
  }
  
  const tradesHtml = currentData.trades.map(trade => {
    const pnlClass = trade.pnl >= 0 ? 'positive' : 'negative';
    const sideClass = trade.side.toLowerCase();
    const closeTimeText = trade.close_time ? new Date(trade.close_time).toLocaleString('zh-CN', { hour12: false }) : '--';
    
    return `
      <div class="trade-item">
        <div class="trade-header">
          <span class="trade-symbol">${trade.symbol}</span>
          <span class="trade-side ${sideClass}">${trade.side}</span>
        </div>
        <div class="trade-details">
          <div class="trade-detail">
            <span class="label">数量:</span>
            <span class="value">${trade.qty}</span>
          </div>
          <div class="trade-detail">
            <span class="label">入场价:</span>
            <span class="value">$${trade.entry_price}</span>
          </div>
          <div class="trade-detail">
            <span class="label">出场价:</span>
            <span class="value">$${trade.close_price}</span>
          </div>
          <div class="trade-detail time-under-exit">
            <span class="label">时间:</span>
            <span class="value">${closeTimeText}</span>
          </div>
        </div>
        <div class="trade-pnl ${pnlClass}">
          ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)} (${trade.pnl_percent.toFixed(2)}%)
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = tradesHtml;
}

// 更新AI日志列表
function updateAILogsList() {
  const container = document.getElementById('aiLogsContainer');
  const countElement = document.getElementById('aiLogsCount');
  
  countElement.textContent = currentData.aiLogs.length;
  
  if (currentData.aiLogs.length === 0) {
    container.innerHTML = '<div class="empty">暂无AI分析记录</div>';
    return;
  }
  
  const logsHtml = currentData.aiLogs.map(log => `
    <div class="ai-log-item">
      <div class="ai-log-time">${log.time}</div>
      <div class="ai-log-analysis">${log.analysis}</div>
    </div>
  `).join('');
  
  container.innerHTML = logsHtml;
}

// 更新统计信息
function updateStats() {
  // 总交易数
  document.getElementById('totalTrades').textContent = currentData.trades.length;
  
  // 胜率计算
  if (currentData.trades.length > 0) {
    const winningTrades = currentData.trades.filter(trade => trade.pnl > 0).length;
    const winRate = (winningTrades / currentData.trades.length * 100).toFixed(1);
    document.getElementById('winRate').textContent = winRate + '%';
  } else {
    document.getElementById('winRate').textContent = '--';
  }
  
  // AI分析次数
  document.getElementById('totalAnalysis').textContent = currentData.aiLogs.length;
}

// 更新最后同步时间
function updateLastSyncTime() {
  const now = new Date();
  const timeString = now.toLocaleString('zh-CN');
  
  const lastUpdatedEl = document.getElementById('lastUpdated');
  const lastSyncEl = document.getElementById('lastSyncTime');
  if (lastUpdatedEl) lastUpdatedEl.textContent = `最后更新: ${timeString}`;
  if (lastSyncEl) lastSyncEl.textContent = timeString;
}

// 开始自动刷新
function startAutoRefresh() {
  // 每30秒刷新一次数据
  setInterval(loadData, 30000);
  
  // 每5秒更新同步状态
  setInterval(() => {
    const syncEl = document.getElementById('syncStatus');
    if (syncEl) syncEl.textContent = '同步中';
  }, 5000);
}

// 显示错误信息
function showError(message) {
  console.error(message);
  // 可以在这里添加用户友好的错误提示
}

// 导出数据（用于调试）
window.exportData = function() {
  console.log('当前数据:', currentData);
  return currentData;
};