const publicContent = require('./public-content');
const examRules = require('./assessments');

function school(meta) { return { schoolName: publicContent.text(meta, 'schoolName'), address: publicContent.text(meta, 'address') }; }
function dateText(value) {
  if (!value) return 'Waktu belum dicatat';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date) + ' WIB';
}
function materialDocument(item, meta) {
  return { ...school(meta), title: item.title || 'Materi pembelajaran', subject: item.subject || '', grade: item.grade || '',
    draft: item.status !== 'Siap digunakan', updatedAt: dateText(item.updatedAt), summary: item.summary || '', content: item.content || '' };
}
function numberText(value) { return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value) : 'Belum dicatat'; }
function responseText(question, value) {
  if (!value) return 'Tidak dijawab';
  if (question.type !== 'Pilihan Ganda') return value;
  const options = question.options || [];
  const key = examRules.answerLetter(value, options);
  const index = key ? key.charCodeAt(0) - 65 : -1;
  return index >= 0 ? `${key}. ${examRules.optionText(options[index], index)}` : value;
}
function gradingDocument(item, currentAssessment, meta) {
  const detailed = item.schemaVersion === 1 && !!item.assessmentSnapshot?.questions?.length;
  const exam = detailed ? item.assessmentSnapshot : currentAssessment || {};
  return { ...school(meta), title: exam.title || 'Ulangan lama', subject: exam.subject || '', grade: exam.grade || '',
    studentName: item.studentName || 'Nama belum dicatat', studentNumber: item.studentNumber || '', updatedAt: dateText(item.updatedAt || item.createdAt),
    score: numberText(item.score), notes: item.notes || '', detailed,
    earnedPoints: detailed ? numberText(item.earnedPoints) : '', maxPoints: detailed ? numberText(item.maxPoints) : '',
    correct: detailed ? item.correct : null, partial: detailed ? item.partial : null, wrong: detailed ? item.wrong : null, unanswered: detailed ? item.unanswered : null,
    questions: detailed ? exam.questions.map((question, index) => {
      const answer = item.answers?.find((value) => value.questionId === question.id);
      return { number: index + 1, type: question.type, text: question.text || '',
        response: answer ? responseText(question, answer.response) : 'Jawaban belum dicatat',
        reference: responseText(question, question.correct || question.answer), points: numberText(answer?.points),
        feedback: answer?.feedback || '', explanation: question.explanation || '' };
    }) : [],
  };
}
module.exports = { school, dateText, materialDocument, gradingDocument };
