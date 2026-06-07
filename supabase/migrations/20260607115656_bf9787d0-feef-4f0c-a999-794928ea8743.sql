UPDATE public.marks_unlock_requests
SET status = 'used',
    admin_note = COALESCE(admin_note, 'Resolved automatically: old Arithmetics unlock request matched a renamed/current Arithmetic subject request.'),
    updated_at = now()
WHERE id = '0fd89ca2-b927-4b3d-9c0b-013a4368bda0'
  AND status = 'approved'
  AND teacher_id = '47c1525f-1619-4ef4-bfe6-6984b5da5ad0'
  AND lower(coalesce(student_name, '')) = lower('LUQMAN MALIKI')
  AND lower(coalesce(subject_name, '')) = lower('Arithmetics');