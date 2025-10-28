(function(){
  const DATA_BASE = 'data';
  let REFRESH_MS = 60000; // 默认60秒

  const $ = (id)=>document.getElementById(id);
  const fmt = (n, d=2)=>Number(n||0).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});

  let chart;
  let refreshInterval;

  async function fetchJSON(path){
    const url = `${DATA_BASE}/${path}?t=${Date.now()}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error(`加载失败: ${path}`);
    return await res.json();
  }

  function initChart(){
    chart = echarts.init($("equityChart"));
    chart.setOption({
      grid:{left:60,right:40,top:40,bottom:60},
      tooltip:{
        trigger:'axis',
        backgroundColor:'rgba(0,0,0,0.8)',
        borderColor:'rgba(255,255,255,0.2)',
        textStyle:{color:'#fff'},
        formatter: function (params) {
          if (!params || params.length === 0) return '';
          const param = params[0];
          const date = new Date(param.value[0]);
          return `${date.toLocaleString()}<br/>账户价值: $${fmt(param.value[1])}`;
        }
      },
      xAxis:{
        type:'time',
        axisLabel:{color:'#888',fontSize:12},
        axisLine:{lineStyle:{color:'#333'}},
        splitLine:{show:false}
      },
      yAxis:{
        type:'value',
        axisLabel:{color:'#888',formatter:v=>`$${fmt(v)}`,fontSize:12},
        axisLine:{lineStyle:{color:'#333'}},
        splitLine:{lineStyle:{color:'#222'}}
      },
      series:[{
        type:'line',
        name:'账户价值',
        showSymbol:false,
        lineStyle:{width:3,color:'#667eea'},
        areaStyle:{
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            {offset: 0, color: 'rgba(102, 126, 234, 0.3)'},
            {offset: 1, color: 'rgba(102, 126, 234, 0.05)'}
          ])
        },
        data:[]
      }]
    });
    window.addEventListener('resize',()=>chart&&chart.resize());
  }

  function toPairs(timestamps, values){
    const out=[]; const len=Math.min((timestamps||[]).length,(values||[]).length);
    for(let i=0;i<len;i++){ out.push([timestamps[i], values[i]]); }
    return out;
  }

  async function loadEquity(){
    try{
      const acc = await fetchJSON('account_history.json');
      const pairs = toPairs(acc.timestamps, acc.values);
      chart.setOption({series:[{data:pairs}]});
      
      // 更新最高最低值
      if (pairs.length > 0) {
        const values = pairs.map(p => p[1]);
        const max = Math.max(...values);
        const min = Math.min(...values);
        $('highestValue').textContent = `$${fmt(max)}`;
        $('lowestValue').textContent = `$${fmt(min)}`;
      }
      
      return acc.last_updated || (acc.timestamps||[]).slice(-1)[0] || '';
    }catch(e){
      console.error(e);
      return '';
    }
  }

  function renderTrades(trades){
    const wrap = $("tradesContainer");
    if(!trades || trades.length===0){ 
      wrap.innerHTML = '<div class="empty">暂无交易记录</div>'; 
      return; 
    }
    
    // 只显示最近100笔
    const recentTrades = trades.slice(-100).reverse();
    
    const html = recentTrades.map(t=>{
      const pnl = Number(t.pnl||0);
      const pnlCls = pnl>=0?'positive':'negative';
      const sideText = t.side === 'Buy' ? '多头' : '空头';
      const tradeType = `完成了一笔${sideText}交易`;
      
      return `<div class="trade-item ${pnlCls}">
        <div class="trade-header">
          <span class="bot-name">PRISM X Bot</span>
          <span class="trade-type">${tradeType}</span>
        </div>
        <div class="coin-info">
          <span class="coin-symbol">${t.symbol||'-'}</span>
        </div>
        <div class="price-info">
          <span>入场: $${fmt(t.entry_price||0)}</span>
          <span>出场: $${fmt(t.close_price||0)}</span>
        </div>
        <div class="price-info">
          <span>数量: ${fmt(t.qty||0, 4)}</span>
          <span>时长: ${t.duration||'-'}</span>
        </div>
        <div class="pnl ${pnlCls}">${pnl>=0?'+':''}$${fmt(pnl)}</div>
        <div class="timestamp">${new Date(t.close_time||t.entry_time||'').toLocaleString()}</div>
      </div>`;
    }).join('');
    wrap.innerHTML = html;
  }

  async function loadTrades(){
    try{
      const data = await fetchJSON('trades.json');
      renderTrades(data || []);
    }catch(e){
      console.error(e);
      $("tradesContainer").innerHTML = '<div class="empty">交易数据加载失败</div>';
    }
  }

  function renderAiLogs(list){
    const wrap = $("aiLogsContainer");
    if(!list || list.length===0){ 
      wrap.innerHTML = '<div class="empty">暂无AI日志</div>'; 
      return; 
    }
    
    // 只显示最近50条，最新在前
    const logs = list.slice(-50).reverse();
    const html = logs.map(l=>{
      const time = l.time || l.timestamp || '';
      const analysis = l.analysis || l.text || '';
      return `<div class="ai-log-item">
        <div class="log-time">${time}</div>
        <div class="log-analysis">${analysis}</div>
      </div>`;
    }).join('');
    wrap.innerHTML = html;
  }

  async function loadAiLogs(){
    try{
      const data = await fetchJSON('ai_logs.json');
      renderAiLogs(data || []);
    }catch(e){
      console.error(e);
      $("aiLogsContainer").innerHTML = '<div class="empty">AI日志加载失败</div>';
    }
  }


  function initTabs(){
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        // 移除所有active类
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        
        // 添加active类
        btn.classList.add('active');
        document.getElementById(`${tab}-panel`).classList.add('active');
      });
    });
  }


  async function refresh(){
    const ts = await loadEquity();
    await loadTrades();
    await loadAiLogs();
    
    if(ts) $('lastUpdated').textContent = `最后更新: ${new Date(ts).toLocaleString()}`;
    
    // 更新底部性能摘要
    try {
      const acc = await fetchJSON('account_history.json');
      if (acc && acc.values && acc.values.length > 0) {
        const currentValue = acc.values[acc.values.length - 1];
        $('botValue').textContent = `$${fmt(currentValue)}`;
      }
    } catch (e) {
      console.error('更新性能摘要失败:', e);
    }
  }

  async function boot(){
    initChart();
    initTabs();
    await refresh();
    
    refreshInterval = setInterval(refresh, REFRESH_MS);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();


