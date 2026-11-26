import jsPDF from 'jspdf';
import dasLogo from '@/assets/das-logo.png';
import type { PerformanceTape, TeacherPerformanceLetter } from '@/types/teacherPerformance';

const TAPE_RGB: Record<PerformanceTape, [number, number, number]> = {
  green: [22, 163, 74],
  yellow: [234, 179, 8],
  red: [220, 38, 38],
};

function formatLetterDate(value: string | null) {
  if (!value) return 'Date not set';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function loadImageData(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) return resolve(null);
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function letterCopy(letter: TeacherPerformanceLetter) {
  const lowNames = letter.lowestStudents.map((student) => student.name).join(', ');
  const subjectSummary = (letter.subjects || [])
    .map((s) => `${s.subjectName} (${s.average}%, Grade ${s.grade}, ${s.tape.toUpperCase()} TAPE)`)
    .join('; ');
  const classLabel = letter.className || letter.classes[0] || '';
  if (letter.tape === 'green') return {
    subject: 'PERFORMANCE COMMENDATION - PLACEMENT ON GREEN TAPE.',
    paragraphs: [
      `Following the review of ${letter.term} results for ${classLabel} in the ${letter.academicYear} academic year, the school management is pleased to note that your students achieved an overall average of ${letter.average}% (Grade ${letter.grade}).`,
      ...(subjectSummary ? [`Subject performance breakdown for ${classLabel}: ${subjectSummary}.`] : []),
      'Based on these results, you are hereby placed under Green Tape in recognition of your strong academic performance and commitment to effective teaching.',
      'The school appreciates your lesson preparation, student follow-up, assessment, and academic support. Your work has made a positive contribution to the progress of the students under your responsibility.',
      'You are encouraged to maintain this standard, continue supporting every learner, and share effective practices with your colleagues so that the school may sustain and improve its academic performance.',
    ],
  };
  if (letter.tape === 'yellow') return {
    subject: 'PERFORMANCE NOTICE - PLACEMENT ON YELLOW TAPE.',
    paragraphs: [
      `Following the review of ${letter.term} results for ${classLabel} in the ${letter.academicYear} academic year, the school management has noted that your students achieved an overall average of ${letter.average}% (Grade ${letter.grade}), which requires improvement.`,
      ...(subjectSummary ? [`Subject performance breakdown for ${classLabel}: ${subjectSummary}.`] : []),
      'Based on these results, you are hereby placed under Yellow Tape as a performance notice and a clear indication that your current academic performance requires improvement.',
      lowNames ? `It is particularly concerning that some students under your responsibility, including ${lowNames}, recorded results below the expected level. More effort is required in teaching, student follow-up, assessment, and academic support.` : 'More effort is required in teaching, student follow-up, assessment, and academic support.',
      'You are required to increase your efforts and take immediate measures to improve the academic performance of your students. Closely monitor learners performing below expectations, identify their areas of weakness, and provide the necessary remedial support.',
      'The school expects your average performance to increase in the next examination. Your performance and the academic progress of your students will continue to be monitored by the school management.',
    ],
  };
  return {
    subject: 'PERFORMANCE WARNING - PLACEMENT ON RED TAPE.',
    paragraphs: [
      `Following the review of ${letter.term} results for ${classLabel} in the ${letter.academicYear} academic year, the school management has found that your students achieved an overall average of ${letter.average}% (Grade ${letter.grade}), which is substantially below the required standard.`,
      ...(subjectSummary ? [`Subject performance breakdown for ${classLabel}: ${subjectSummary}.`] : []),
      'You are hereby placed under Red Tape as a formal performance warning. This result requires immediate and measurable corrective action.',
      lowNames ? `Students requiring urgent attention include ${lowNames}. Their results show the need for stronger lesson delivery, closer follow-up, regular assessment, and focused remedial support.` : 'The results show the need for stronger lesson delivery, closer follow-up, regular assessment, and focused remedial support.',
      'You are required to prepare and implement an immediate improvement plan, monitor weak students closely, and work with school leadership to address identified gaps before the next examination.',
      'Your performance will be reviewed again after the next examination. The school expects a clear improvement in the average performance of the students under your responsibility.',
    ],
  };
}

export async function generateTeacherPerformancePDF(letter: TeacherPerformanceLetter) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 24;
  const copy = letterCopy(letter);
  const logo = await loadImageData(dasLogo);

  if (logo) doc.addImage(logo, 'PNG', pageWidth / 2 - 10, 10, 20, 20);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('DAARUL-ARQAM ISLAMIC SCHOOLS', pageWidth / 2, 39, { align: 'center' });
  doc.setFontSize(9);
  doc.text('P.O BOX 80059  Email: darqamschool@gmail.com  Tel: +255718999777, +255715250026', pageWidth / 2, 47, { align: 'center' });
  doc.setLineWidth(0.25);
  doc.line(margin, 49, pageWidth - margin, 49);

  doc.setFontSize(10.5);
  doc.text(`Date: ${formatLetterDate(letter.examDate)}`, pageWidth - margin, 60, { align: 'right' });
  doc.text(`To: ${letter.teacherName}`, margin, 72);
  const classLabel = letter.className || letter.classes[0] || '';
  const subjectList = (letter.subjects || []).map((s) => s.subjectName).join(', ');
  doc.setFontSize(10);
  doc.text(`Class: ${classLabel}${subjectList ? `   |   Subject(s): ${subjectList}` : ''}`, margin, 78);
  doc.setFontSize(10);
  doc.text(copy.subject, margin, 87);
  doc.line(margin, 88.5, margin + doc.getTextWidth(copy.subject), 88.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  let y = 98;
  const contentWidth = pageWidth - margin * 2;
  copy.paragraphs.forEach((paragraph) => {
    const lines = doc.splitTextToSize(paragraph, contentWidth);
    doc.text(lines, margin, y, { align: 'justify', maxWidth: contentWidth, lineHeightFactor: 1.45 });
    y += lines.length * 5.8 + 5;
  });

  y = Math.min(y + 2, 242);
  doc.text('Yours faithfully,', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text((letter.signatoryName || 'HEAD TEACHER').toUpperCase(), margin, y + 18);
  doc.text((letter.signatoryTitle || 'HEAD TEACHER').toUpperCase(), margin, y + 24);

  const color = TAPE_RGB[letter.tape];
  doc.setFillColor(...color);
  doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`${letter.tape.toUpperCase()} TAPE  |  ${classLabel}  |  ${letter.term}  |  ${letter.academicYear}`, pageWidth / 2, pageHeight - 4, { align: 'center' });
  doc.save(`${letter.teacherName.replace(/[^a-z0-9]+/gi, '_')}_${classLabel.replace(/\s+/g, '_')}_${letter.term.replace(/\s+/g, '_')}_${letter.tape}_tape.pdf`);
}
