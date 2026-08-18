-- ============================================================
-- XPERISE METRICS — sửa view v_monthly
--
-- Vấn đề: view cũ lấy monthly_actual làm bảng gốc, nên tháng nào
-- mới chỉ có kế hoạch mà chưa có số thực tế thì không xuất hiện.
-- Dashboard vì thế dừng ở tháng 7.
--
-- Cách sửa: gộp danh sách kỳ từ cả hai bảng. Tháng chưa có thực tế
-- vẫn hiện, cột thực tế để NULL — không phải 0, vì 0 nghĩa là
-- "doanh thu bằng không", còn NULL nghĩa là "chưa có số".
--
-- Dán toàn bộ vào Supabase SQL Editor rồi Run. Không mất dữ liệu.
-- ============================================================

create or replace view v_monthly as
with periods as (
  select period from monthly_actual
  union
  select period from monthly_target
)
select
  p.period,

  -- tháng chưa có số thực tế: has_actual = false, dashboard dựa vào đây
  (a.period is not null)                                   as has_actual,
  coalesce(a.is_forecast, false)                           as is_forecast,

  a.rev_travel, a.rev_mobility, a.rev_other,
  a.rev_subscription, a.rev_licence, a.rev_oneoff,

  case when a.period is null then null else
    a.rev_travel + a.rev_mobility + a.rev_other end        as rev_stream_a,
  case when a.period is null then null else
    a.rev_subscription + a.rev_licence + a.rev_oneoff end  as rev_stream_b,
  case when a.period is null then null else
    a.rev_travel + a.rev_mobility + a.rev_other
    + a.rev_subscription + a.rev_licence + a.rev_oneoff end as total_revenue,

  a.total_customers, a.active_customers,
  a.total_users,     a.active_users,

  t.target_revenue, t.target_customers, t.target_users,

  -- % đạt: NULL khi chưa có thực tế, để dashboard hiện gạch ngang
  -- thay vì 0% — 0% sẽ bị hiểu nhầm là "hụt hoàn toàn kế hoạch"
  case when a.period is null then null else
    round(100.0 * (a.rev_travel + a.rev_mobility + a.rev_other
                   + a.rev_subscription + a.rev_licence + a.rev_oneoff)
          / nullif(t.target_revenue, 0), 1) end            as revenue_pct,
  case when a.period is null then null else
    round(100.0 * a.total_customers
          / nullif(t.target_customers, 0), 1) end          as customers_pct,
  case when a.period is null then null else
    round(100.0 * a.total_users
          / nullif(t.target_users, 0), 1) end              as users_pct,

  round(100.0 * a.active_customers
        / nullif(a.total_customers, 0), 1)                 as customer_active_rate,
  round(100.0 * a.active_users
        / nullif(a.total_users, 0), 1)                     as user_active_rate,

  round((a.rev_travel + a.rev_mobility + a.rev_other
         + a.rev_subscription + a.rev_licence + a.rev_oneoff)::numeric
        / nullif(a.total_customers, 0), 0)                 as arpc,
  round((a.rev_travel + a.rev_mobility + a.rev_other
         + a.rev_subscription + a.rev_oneoff)::numeric
        / nullif(a.total_customers, 0), 0)                 as arpc_ex_licence,

  -- kế hoạch doanh thu trên mỗi khách, để vẽ đường mục tiêu tới tháng 12
  round(t.target_revenue::numeric
        / nullif(t.target_customers, 0), 0)                as target_arpc,

  round(100.0 * (a.rev_subscription + a.rev_licence + a.rev_oneoff)
        / nullif(a.rev_travel + a.rev_mobility + a.rev_other
                 + a.rev_subscription + a.rev_licence + a.rev_oneoff, 0), 2)
                                                            as stream_b_share
from periods p
left join monthly_actual a on a.period = p.period
left join monthly_target t on t.period = p.period
order by p.period;

-- ---------- KIỂM TRA ----------
-- Phải ra đủ 12 dòng. Tháng 8 đến 12 có ke_hoach nhưng thuc_te trống.
select
  to_char(period, 'Mon-YY')            as ky,
  has_actual                           as co_so_thuc_te,
  round(total_revenue  / 1e9, 3)       as thuc_te_ty,
  round(target_revenue / 1e9, 3)       as ke_hoach_ty,
  revenue_pct                          as pct_dat,
  total_customers                      as kh_thuc_te,
  target_customers                     as kh_ke_hoach,
  total_users                          as nd_thuc_te,
  target_users                         as nd_ke_hoach
from v_monthly
order by period;
