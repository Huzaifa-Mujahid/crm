const addMonths = (date, months) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
};

export const getNextRecurringDueDate = (project, projectPayments = []) => {
  const startDate = project.start_date ? new Date(project.start_date) : new Date();
  const sortedProjectPayments = [...projectPayments].sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));
  const latestPayment = sortedProjectPayments[sortedProjectPayments.length - 1];

  let nextDueDate = startDate;

  if (latestPayment?.due_date) {
    const lastDue = new Date(latestPayment.due_date);
    if (latestPayment.is_paid) nextDueDate = addMonths(lastDue, 1);
    else nextDueDate = lastDue;
  }

  return nextDueDate;
};

export const ensureRecurringPaymentRows = async ({ supabase, projects = [], payments = [] }) => {
  if (!supabase || !projects.length) return [];

  const inserted = [];

  for (const project of projects) {
    if (project.billing_type !== 'Retainer' || project.billing_cycle !== 'Monthly') continue;

    const amount = parseFloat(project.budget || 0);
    if (!amount || !project.client_id) continue;

    // Exclude cancelled rows — they must not influence next-due-date calculation
    const projectPayments = (payments || []).filter(
      (pay) => pay.project_id === project.id && pay.is_cancelled !== true
    );
    const nextDueDate = getNextRecurringDueDate(project, projectPayments);
    const dueDate = nextDueDate.toISOString().split('T')[0];

    // Check for any unpaid record for this project in the same month (not just exact date)
    // This prevents duplicates when a user manually logs a payment for the same period.
    const monthStart = dueDate.slice(0, 7) + '-01'; // e.g. "2026-07-01"
    const monthEnd   = dueDate.slice(0, 7) + '-31'; // e.g. "2026-07-31" (safe upper bound)

    const { data: existingRows, error: existingErr } = await supabase
      .from('payments')
      .select('id')
      .eq('project_id', project.id)
      .eq('is_paid', false)
      .not('is_cancelled', 'is', true)
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd)
      .limit(1);

    if (existingErr) {
      console.warn('Recurring payments duplicate check failed:', existingErr.message);
      continue;
    }

    if (existingRows && existingRows.length > 0) continue;

    const { error } = await supabase.from('payments').insert([{
      project_id: project.id,
      amount,
      payment_type: 'Monthly',
      due_date: dueDate,
      is_paid: false,
      payment_date: null,
    }]);

    if (!error) inserted.push({ project_id: project.id, due_date: dueDate, amount });
  }

  return inserted;
};
