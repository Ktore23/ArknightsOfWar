import { characterDataObj } from './character.js';

let selectedCharacters = [];
let currentCharacter = null;

const characterData = characterDataObj;

// Tạo danh sách nhân vật động
function populateCharacterList() {
  const characterList = document.getElementById('characterList');
  characterList.innerHTML = ''; // Xóa nội dung cũ
  Object.keys(characterData).forEach(name => {
    const charDiv = document.createElement('div');
    charDiv.classList.add('character');
    charDiv.setAttribute('data-name', name);
    charDiv.innerHTML = `
      <img src="${characterData[name].image.replace('150', '60')}" alt="${name}">
      <p>${name}</p>
    `;
    characterList.appendChild(charDiv);
  });
}

function showCharacterSelection() {
  document.getElementById('characterSelection').style.display = 'flex';
  window.pauseSlideshow();
  document.querySelectorAll('.character').forEach(char => {
    char.addEventListener('click', handleCharacterClick);
  });
  updateCharacterSelection();
}

function closeCharacterSelection() {
  document.getElementById('characterSelection').style.display = 'none';
  selectedCharacters = [];
  currentCharacter = null;
  updateCharacterSelection();
  updateCharacterInfo();
  window.resumeSlideshow();
}

function handleCharacterClick(event) {
  const character = event.currentTarget;
  const charName = character.getAttribute('data-name');

  if (selectedCharacters.includes(charName)) {
    selectedCharacters = selectedCharacters.filter(name => name !== charName);
  } else if (selectedCharacters.length < 3) {
    selectedCharacters.push(charName);
  }

  currentCharacter = charName;
  updateCharacterSelection();
  updateCharacterInfo();
}

function updateCharacterSelection() {
  const startButton = document.querySelector('.start-game-button');
  startButton.disabled = selectedCharacters.length < 1;
  document.querySelectorAll('.character').forEach(char => {
    const charName = char.getAttribute('data-name');
    if (selectedCharacters.includes(charName)) {
      char.classList.add('selected');
    } else {
      char.classList.remove('selected');
    }
  });

  const selectedList = document.getElementById('selectedList');
  selectedList.innerHTML = '';
  selectedCharacters.forEach(name => {
    const img = document.createElement('img');
    img.src = characterData[name].image.replace('150', '50');
    img.alt = name;
    selectedList.appendChild(img);
  });
}

function updateCharacterInfo() {
  const infoContent = document.querySelector('.info-content');
  const infoName = document.getElementById('infoName');
  const infoStats = document.getElementById('infoStats');
  const infoSkills = document.getElementById('infoSkills');
  const infoTalent = document.getElementById('infoTalent');
  const infoTrait = document.getElementById('infoTrait');

  if (currentCharacter && characterData[currentCharacter]) {
    const data = characterData[currentCharacter];
    infoName.textContent = currentCharacter;
    infoStats.innerHTML = `
      <h5>Chỉ số</h5>
      <ul>
        <li>HP: ${data.hp}</li>
        <li>Kháng vật lý: ${data.def}</li>
        <li>Kháng phép: ${data.res}</li>
        <li>Tốc chạy: ${data.spd}</li>
        <li>Tốc đánh: ${data.spdatk}</li>
        <li>Tấn công: ${data.atk}</li>
        <li>DP: ${data.dp}</li>
        <li>CD: ${data.cd}s</li>
      </ul>
    `;
    infoSkills.innerHTML = `
      <h5>Kỹ năng</h5>
      <ul>
        <li>${data.skill1}</li>
        <li>${data.skill2}</li>
        <li>${data.skill3}</li>
      </ul>
    `;
    infoTalent.innerHTML = `
      <h5>Thiên phú</h5>
      <p>${data.talent}</p>
    `;
    infoTrait.innerHTML = `
      <h5>Đặc tính</h5>
      <p>${data.trait}</p>
    `;
    infoContent.style.display = 'block';
    document.querySelector('.character-info h3').style.display = 'none';
  } else {
    infoContent.style.display = 'none';
    document.querySelector('.character-info h3').style.display = 'block';
    infoStats.innerHTML = '';
    infoSkills.innerHTML = '';
    infoTalent.innerHTML = '';
    infoTrait.innerHTML = '';
  }
}

function startGame() {
  if (selectedCharacters.length === 0) {
    alert('Vui lòng chọn ít nhất 1 nhân vật!');
    return;
  }
  localStorage.setItem('selectedCharacters', JSON.stringify(selectedCharacters)); // Lưu danh sách đã chọn
  window.location.href = 'game.html'; // Chuyển sang game.html (thay nếu tên file khác)
  // alert(`Bắt đầu trò chơi với các nhân vật: ${selectedCharacters.join(', ')}`); // Comment out cái cũ
  closeCharacterSelection();
}

// Gắn sự kiện và tạo danh sách nhân vật khi trang tải
document.addEventListener('DOMContentLoaded', () => {
  populateCharacterList(); // Tạo danh sách nhân vật
  const playButton = document.getElementById('playButton');
  const closeButton = document.getElementById('closeButton');
  const startButton = document.querySelector('.start-game-button');
  if (playButton) {
    playButton.addEventListener('click', showCharacterSelection);
  }
  if (closeButton) {
    closeButton.addEventListener('click', closeCharacterSelection);
  }
  if (startButton) {
    startButton.addEventListener('click', startGame);
  }
});