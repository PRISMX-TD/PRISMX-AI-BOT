// 全局变量
let equityChart = null;
let currentData = {
  accountHistory: [],
  trades: [],
  aiLogs: []
};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  initializeChart();
  loadData();
  setupEventListeners();
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
}

// 初始化图表
function initializeChart() {
  const chartDom = document.getElementById('equityChart');
  equityChart = echarts.init(chartDom);
  
  const option = {
    backgroundColor: 'transparent',
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.2)'
        }
      },
      axisLabel: {
        color: '#8892b0',
        fontSize: 12
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.2)'
        }
      },
      axisLabel: {
        color: '#8892b0',
        fontSize: 12,
        formatter: function(value) {
          return '$' + value.toLocaleString();
        }
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: 'rgba(0, 212, 255, 0.5)',
      textStyle: {
        color: '#ffffff'
      },
      formatter: function(params) {
        if (params.length === 0) return '';
        const data = params[0];
        const time = new Date(data.axisValue).toLocaleString('zh-CN');
        return `${time}<br/>账户净值: $${data.value.toLocaleString()}`;
      }
    },
    series: [{
      name: '账户净值',
      type: 'line',
      data: [],
      smooth: true,
      lineStyle: {
        color: '#00d4ff',
        width: 2
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(0, 212, 255, 0.3)' },
            { offset: 1, color: 'rgba(0, 212, 255, 0.05)' }
          ]
        }
      },
      symbol: 'none'
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
    currentData.accountHistory = data.values || [];
    
    // 处理时间戳
    if (data.timestamps && data.timestamps.length > 0) {
      currentData.accountHistory = currentData.accountHistory.map((value, index) => [
        new Date(data.timestamps[index]).getTime(),
        value
      ]);
    }
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
    currentData.trades = Array.isArray(data) ? data : [];
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
    currentData.aiLogs = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('加载AI日志失败:', error);
    currentData.aiLogs = [];
  }
}

// 更新图表
function updateChart() {
  if (!equityChart || currentData.accountHistory.length === 0) return;
  
  const option = {
    series: [{
      data: currentData.accountHistory
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
          <div class="trade-detail">
            <span class="label">时间:</span>
            <span class="value">${trade.close_time}</span>
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
  
  document.getElementById('lastUpdated').textContent = `最后更新: ${timeString}`;
  document.getElementById('lastSyncTime').textContent = timeString;
}

// 开始自动刷新
function startAutoRefresh() {
  // 每30秒刷新一次数据
  setInterval(loadData, 30000);
  
  // 每5秒更新同步状态
  setInterval(() => {
    document.getElementById('syncStatus').textContent = '同步中';
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