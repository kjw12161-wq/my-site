const startExamBtn = document.getElementById("startExamBtn");
let timerInterval;
let timeRemaining = 45 * 60; // 45분 (초 단위)

function startExam() {
  // UI 변경
  document.getElementById('examStartPanel').style.display = 'none';
  const timerBar = document.getElementById('examTimerBar');
  timerBar.style.display = 'flex';

  // 타이머 인터벌 시작
  timerInterval = setInterval(() => {
    timeRemaining--;

    const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const seconds = (timeRemaining % 60).toString().padStart(2, '0');

    const display = document.getElementById('timerDisplay');
    display.textContent = `${minutes}:${seconds}`;

    // 종료 임박 (5분 미만) 시 경고 효과
    if (timeRemaining <= 300) {
      timerBar.classList.add('warning');
    }

    // 타이머 종료
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      display.textContent = "00:00";
      alert("시험 시간이 종료되었습니다!");
    }
  }, 1000);

  // 화면 최상단으로 스크롤 이동
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

startExamBtn.addEventListener("click", startExam);
