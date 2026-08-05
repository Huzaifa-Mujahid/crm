const addMonths = (date, months) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
};

export const getNextRecurringDueDate = (project, projectPayments = []) => {
  const startDate = project.start_date ? new Date(project.start_date) : new Date();
  const startDay = startDate.getDate();
  
  const sortedProjectPayments = [...projectPayments].sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));
  const latestPayment = sortedProjectPayments[sortedProjectPayments.length - 1];

  let nextDueDate = new Date(startDate);

  if (latestPayment?.due_date) {
    const lastDue = new Date(latestPayment.due_date);
    nextDueDate = addMonths(lastDue, 1);
  }

  // Enforce cycle anchor: ensure the next due date always falls on the same day of the month as the start date
  nextDueDate.setDate(startDay);

  return nextDueDate;
};

export const ensureRecurringPaymentRows = async ({ supabase, projects = [], payments = [] }) => {
  if (!supabase || !projects.length) return [];

  const inserted = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  for (const project of projects) {
    if (project.billing_type !== 'Retainer' || project.billing_cycle !== 'Monthly') continue;

    const amount = parseFloat(project.budget || 0);
    if (!amount || !project.client_id) continue;

    // Exclude cancelled rows — they must not influence next-due-date calculation
    let projectPayments = (payments || []).filter(
      (pay) => pay.project_id === project.id && pay.is_cancelled !== true
    );

    let keepGenerating = true;
    while (keepGenerating) {
      const nextDueDate = getNextRecurringDueDate(project, projectPayments);
      
      // Stop generating if we've caught up to the future, UNLESS it's the very first invoice
      if (nextDueDate > today && projectPayments.length > 0) {
        break;
      }

      const dueDate = nextDueDate.toISOString().split('T')[0];

      // Check for any unpaid record for this project in the same month (not just exact date)
      const monthStart = dueDate.slice(0, 7) + '-01';
      const monthEnd   = dueDate.slice(0, 7) + '-31';

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
        break;
      }

      if (existingRows && existingRows.length > 0) {
        // Row already exists in DB but not in our local array (stale initial data)
        // Add to local array so the next iteration advances the date, instead of infinitely looping
        projectPayments.push({ project_id: project.id, due_date: dueDate, amount, is_paid: false });
        continue;
      }

      const { error } = await supabase.from('payments').insert([{
        project_id: project.id,
        amount,
        payment_type: 'Monthly',
        due_date: dueDate,
        is_paid: false,
        payment_date: null,
      }]);

      if (error) {
        break;
      }

      const newPay = { project_id: project.id, due_date: dueDate, amount, is_paid: false };
      projectPayments.push(newPay);
      inserted.push(newPay);

      // If we just inserted the very first invoice and it's in the future, break now so we don't generate more
      if (nextDueDate > today) {
        break;
      }
    }
  }

  return inserted;
};
