export default function StatCard({ label, value, hint, icon: Icon, tone = 'pink' }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        {Icon ? (
          <span className="stat-icon">
            <Icon size={18} />
          </span>
        ) : null}
      </div>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}
