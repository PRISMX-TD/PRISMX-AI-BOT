(function(){
  const DATA_BASE = 'data'; // 相对路径，GitHub Pages 直接读取仓库中的JSON文件
  const REFRESH_MS = 60000; // 每60s自动刷新一次

  const $ = (id)=>document.getElementById(id);
  const fmt = (n, d=2)=>Number(n||0).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});

  let chart;

  async function fetchJSON(path){
    const url = `${DATA_BASE}/${path}?t=${Date.now()}`; // 防缓存
    const res = await fetch(url);
    if(!res.ok) throw new Error(`加载失败: ${path}`);
    return await res.json();
  }

  function initChart(){
    chart = echarts.init($("equityChart"));
    chart.setOption({
      grid:{left:40,right:20,top:20,bottom:30},
      tooltip:{trigger:'axis',valueFormatter:v=>`$${fmt(v)}`},
      xAxis:{type:'time',axisLabel:{color:'#888'}},
      yAxis:{type:'value',axisLabel:{color:'#888',formatter:v=>`$${fmt(v)}`},splitLine:{lineStyle:{color:'#222'}}},
      series:[{type:'line',name:'账户价值',showSymbol:false,lineStyle:{width:2,color:'#9d4edd'},
        areaStyle:{opacity:0.12,color:'#9d4edd'},data:[]}]
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
      return acc.last_updated || (acc.timestamps||[]).slice(-1)[0] || '';
    }catch(e){
      console.error(e);
      return '';
    }
  }

  function renderTrades(trades){
    const wrap = $("tradesContainer");
    if(!trades || trades.length===0){ wrap.innerHTML = '<div class="empty">暂无交易</div>'; return; }
    const html = trades.map(t=>{
      const pnl = Number(t.pnl||0);
      const pnlCls = pnl>=0?'pnl-pos':'pnl-neg';
      return `<div class="trade">
        <div>${t.symbol||'-'}</div>
        <div>${t.side||'-'}</div>
        <div>${t.entry_time||'-'} → ${t.close_time||'-'}</div>
        <div>$${fmt(pnl)}</div>
        <div class="${pnlCls}">${pnl>=0?'+':''}${fmt(t.pnl_percent||0)}%</div>
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

  async function refresh(){
    const ts = await loadEquity();
    await loadTrades();
    if(ts) $('lastUpdated').textContent = `最后更新: ${new Date(ts).toLocaleString()}`;
  }

  async function boot(){
    initChart();
    await refresh();
    setInterval(refresh, REFRESH_MS);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();


