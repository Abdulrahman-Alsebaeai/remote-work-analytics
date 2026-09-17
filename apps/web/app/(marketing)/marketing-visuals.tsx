import { Icon, type IconName } from '../ui/icons';

export function DashboardPreview({ ar, compact = false }: { ar: boolean; compact?: boolean }) {
  const bars = [46, 62, 55, 72, 67, 84, 78, 92, 74, 88, 82, 96];
  return <div className={`real-dashboard-preview${compact ? ' compact' : ''}`} aria-label={ar ? 'معاينة من واجهة لوحة المدير' : 'Manager dashboard interface preview'}>
    <div className="preview-browser"><span><i/><i/><i/></span><small>app.remotework.intelligence/dashboard</small><b><Icon name="lock" size={11}/></b></div>
    <div className="preview-app">
      <aside><div className="preview-mini-logo">R</div>{(['dashboard', 'users', 'tasks', 'performance'] as IconName[]).map((name, index) => <span className={index === 0 ? 'active' : ''} key={name}><Icon name={name} size={15}/></span>)}</aside>
      <section>
        <div className="preview-toolbar"><div><small>{ar ? 'مساحة العمل' : 'WORKSPACE'}</small><strong>{ar ? 'صباح الخير، سارة' : 'Good morning, Sarah'}</strong></div><div><i/><span>{ar ? 'مباشر' : 'Live'}</span><b>SA</b></div></div>
        <div className="preview-kpis">
          <PreviewKpi icon="trend" label={ar ? 'الإنتاجية' : 'Productivity'} value="86%" change="+8.4%"/>
          <PreviewKpi icon="focus" label={ar ? 'التركيز' : 'Focus'} value="79%" change="+5.1%"/>
          <PreviewKpi icon="clock" label={ar ? 'الوقت النشط' : 'Active time'} value="38h" change="+3.2h"/>
          <PreviewKpi icon="check" label={ar ? 'المهام المكتملة' : 'Completed'} value="42" change="+12"/>
        </div>
        <div className="preview-main-grid">
          <article className="preview-chart-card"><header><div><strong>{ar ? 'اتجاه الإنتاجية' : 'Productivity trend'}</strong><small>{ar ? 'آخر 7 أيام' : 'Last 7 days'}</small></div><span>7D⌄</span></header><div className="preview-chart-lines"><span>100</span><span>75</span><span>50</span><span>25</span><div className="preview-bars">{bars.map((height, index) => <i key={index} style={{ height: `${height}%` }}/>)}</div><svg viewBox="0 0 600 170" preserveAspectRatio="none"><defs><linearGradient id="previewArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".26"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 135 C65 120 80 86 138 101 S225 54 278 70 S365 35 420 55 S505 28 600 18 L600 170 L0 170Z"/><path d="M0 135 C65 120 80 86 138 101 S225 54 278 70 S365 35 420 55 S505 28 600 18"/></svg></div></article>
          <article className="preview-team-card"><header><div><strong>{ar ? 'أداء الفريق' : 'Team pulse'}</strong><small>{ar ? '10 موظفين نشطين' : '10 active people'}</small></div><Icon name="users" size={15}/></header>{[['AN','Abdullah Nasser',92],['SA','Sara Ahmed',87],['KF','Khalid Fahad',81]].map(([initials, name, score], index) => <div className="preview-person" key={String(name)}><span className={`avatar avatar-${index}`}>{initials}</span><div><strong>{name}</strong><small><i style={{ width: `${score}%` }}/></small></div><b>{score}%</b></div>)}</article>
        </div>
        <div className="preview-bottom-row"><span><Icon name="sparkles" size={14}/><b>{ar ? 'رؤية ذكية' : 'Smart insight'}</b><small>{ar ? 'أفضل ساعات التركيز بين 9 و11 صباحًا' : 'Peak focus occurs between 9–11 AM'}</small></span><span><Icon name="shield" size={14}/><b>{ar ? 'خصوصية واضحة' : 'Clear privacy'}</b><small>{ar ? 'الجمع أثناء الجلسة فقط' : 'Collection only during sessions'}</small></span></div>
      </section>
    </div>
  </div>;
}

function PreviewKpi({ icon, label, value, change }: { icon: IconName; label: string; value: string; change: string }) {
  return <article><span><Icon name={icon} size={13}/></span><small>{label}</small><strong>{value}</strong><b>{change}</b></article>;
}

export function AgentPreview({ ar }: { ar: boolean }) {
  return <div className="agent-preview">
    <div className="agent-window-bar"><div><span className="agent-mark">R</span><strong>Remote Work Agent</strong></div><span>—　□　×</span></div>
    <div className="agent-status"><span className="agent-live"><i/><Icon name="activity" size={14}/></span><div><small>{ar ? 'الجلسة الحالية' : 'CURRENT SESSION'}</small><strong>{ar ? 'التتبع يعمل الآن' : 'Tracking is active'}</strong></div><b>{ar ? 'متصل' : 'Online'}</b></div>
    <div className="agent-timer"><small>{ar ? 'وقت الجلسة' : 'SESSION TIME'}</small><strong>04:28:16</strong><div><span><i style={{ width: '82%' }}/></span><b>82%</b></div></div>
    <div className="agent-grid"><span><Icon name="focus"/><small>{ar ? 'التركيز' : 'Focus'}</small><strong>84%</strong></span><span><Icon name="cloud"/><small>{ar ? 'آخر مزامنة' : 'Last sync'}</small><strong>{ar ? 'منذ 8 ث' : '8 sec ago'}</strong></span></div>
    <div className="agent-task"><header><strong>{ar ? 'المهمة الحالية' : 'Current task'}</strong><span>3 / 5</span></header><p>{ar ? 'مراجعة تقرير الأداء الأسبوعي' : 'Review weekly performance report'}</p><span><i/></span></div>
    <div className="agent-offline"><Icon name="shield" size={15}/><span><strong>{ar ? 'بياناتك محمية' : 'Your data is protected'}</strong><small>{ar ? 'تُحفظ محليًا وتزامن تلقائيًا عند الحاجة' : 'Queued locally and synchronized automatically when needed'}</small></span></div>
  </div>;
}

type IllustrationKind = 'analytics' | 'activity' | 'tasks' | 'privacy' | 'ai' | 'sync';

export function FeatureIllustration({ kind }: { kind: IllustrationKind }) {
  if (kind === 'analytics') return <svg className="feature-illustration" viewBox="0 0 420 260" role="img"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7566e8"/><stop offset="1" stopColor="#9b8df3"/></linearGradient></defs><rect x="28" y="28" width="364" height="204" rx="24" fill="var(--surface)" stroke="var(--border)"/><path d="M72 184V78M72 184h292" stroke="var(--border)"/><path d="M80 170c48-13 56-68 104-52s66-54 112-34 40-25 62-31" fill="none" stroke="url(#a)" strokeWidth="6" strokeLinecap="round"/><path d="M80 170c48-13 56-68 104-52s66-54 112-34 40-25 62-31v117H80Z" fill="url(#a)" opacity=".11"/><circle cx="296" cy="84" r="9" fill="#7566e8" stroke="var(--surface)" strokeWidth="5"/><rect x="244" y="38" width="106" height="34" rx="12" fill="var(--text)"/><text x="297" y="60" textAnchor="middle" fill="var(--surface)" fontSize="var(--type-small)">+18.4% trend</text></svg>;
  if (kind === 'activity') return <svg className="feature-illustration" viewBox="0 0 420 260" role="img"><rect x="28" y="28" width="364" height="204" rx="24" fill="var(--surface)" stroke="var(--border)"/><rect x="55" y="55" width="310" height="38" rx="12" fill="var(--surface-soft)"/><circle cx="77" cy="74" r="8" fill="#53c99d"/><path d="M102 74h74M326 74h18" stroke="var(--muted)" strokeWidth="6" strokeLinecap="round" opacity=".55"/><g fill="#7566e8">{[0,1,2,3,4,5,6].map(day => [0,1,2,3,4,5,6,7,8,9].map(hour => <rect key={`${day}-${hour}`} x={57+hour*30} y={112+day*13} width="23" height="8" rx="3" opacity={(day*3+hour)%5*.18+.16}/>))}</g><path d="M57 218h306" stroke="var(--border)"/></svg>;
  if (kind === 'tasks') return <svg className="feature-illustration" viewBox="0 0 420 260" role="img"><rect x="28" y="28" width="364" height="204" rx="24" fill="var(--surface)" stroke="var(--border)"/><rect x="52" y="52" width="96" height="156" rx="15" fill="var(--surface-soft)"/><rect x="162" y="52" width="96" height="156" rx="15" fill="var(--surface-soft)"/><rect x="272" y="52" width="96" height="156" rx="15" fill="var(--surface-soft)"/><g fill="var(--surface)" stroke="var(--border)"><rect x="62" y="88" width="76" height="48" rx="10"/><rect x="62" y="145" width="76" height="38" rx="10"/><rect x="172" y="88" width="76" height="65" rx="10"/><rect x="282" y="88" width="76" height="45" rx="10"/><rect x="282" y="142" width="76" height="42" rx="10"/></g><circle cx="78" cy="104" r="5" fill="#7566e8"/><circle cx="188" cy="104" r="5" fill="#e0a942"/><circle cx="298" cy="104" r="5" fill="#53c99d"/></svg>;
  if (kind === 'privacy') return <svg className="feature-illustration" viewBox="0 0 420 260" role="img"><defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7566e8"/><stop offset="1" stopColor="#53c99d"/></linearGradient></defs><rect x="28" y="28" width="364" height="204" rx="24" fill="var(--surface)" stroke="var(--border)"/><path d="M210 58 292 88v52c0 53-47 79-82 92-35-13-82-39-82-92V88l82-30Z" fill="url(#p)" opacity=".16"/><path d="M210 72 276 96v44c0 40-35 63-66 76-31-13-66-36-66-76V96l66-24Z" fill="none" stroke="url(#p)" strokeWidth="5"/><rect x="187" y="124" width="46" height="38" rx="9" fill="url(#p)"/><path d="M197 124v-10a13 13 0 0 1 26 0v10" fill="none" stroke="#7566e8" strokeWidth="6"/></svg>;
  if (kind === 'ai') return <svg className="feature-illustration" viewBox="0 0 420 260" role="img"><rect x="28" y="28" width="364" height="204" rx="24" fill="var(--surface)" stroke="var(--border)"/><circle cx="115" cy="130" r="48" fill="#7566e8" opacity=".12"/><path d="m115 90 9 25 25 9-25 9-9 25-9-25-25-9 25-9 9-25Z" fill="#7566e8"/><rect x="190" y="72" width="148" height="18" rx="9" fill="var(--surface-soft)"/><rect x="190" y="105" width="126" height="13" rx="7" fill="var(--surface-soft)"/><rect x="190" y="132" width="145" height="13" rx="7" fill="var(--surface-soft)"/><rect x="190" y="159" width="98" height="13" rx="7" fill="#53c99d" opacity=".42"/><circle cx="345" cy="180" r="22" fill="#7566e8"/><path d="m335 180 7 7 14-15" fill="none" stroke="#fff" strokeWidth="4"/></svg>;
  return <svg className="feature-illustration" viewBox="0 0 420 260" role="img"><rect x="28" y="28" width="364" height="204" rx="24" fill="var(--surface)" stroke="var(--border)"/><path d="M145 164h-20a39 39 0 1 1 16-75 55 55 0 0 1 104 13 33 33 0 1 1 15 62h-17" fill="var(--primary-soft)" stroke="#7566e8" strokeWidth="4"/><path d="m210 112-27 27h18v47h18v-47h18l-27-27Z" fill="#7566e8"/><circle cx="101" cy="187" r="13" fill="#53c99d"/><path d="m95 187 4 4 8-9" fill="none" stroke="#fff" strokeWidth="3"/><path d="M123 187h55M242 187h76" stroke="var(--border)" strokeWidth="8" strokeLinecap="round"/></svg>;
}
