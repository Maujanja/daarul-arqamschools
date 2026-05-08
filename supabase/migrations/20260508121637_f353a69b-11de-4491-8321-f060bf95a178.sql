UPDATE marks SET total = total/2, exam = exam/2,
  grade = CASE 
    WHEN total/2 >= 41 THEN 'A'
    WHEN total/2 >= 31 THEN 'B'
    WHEN total/2 >= 21 THEN 'C'
    WHEN total/2 >= 11 THEN 'D'
    ELSE 'E' END
WHERE class='Primary 7' AND academic_year='2025-2026' AND total > 50
  AND student_id IN ('9c103409-5734-4ff5-9591-29af836b780c','4883e760-ae6d-4eb3-85bc-cc925c35218b','05455940-6a86-400e-bf4c-f55dc1220b26','34e9dede-d093-4b8d-82d1-13e587562ffd','f4672dc1-45ca-4efe-ac3c-39f0ccb3c944');