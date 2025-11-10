const API_BASE = '/api/availabilities';

const timeSlots = [
  "08:00-09:00","09:00-10:00","10:00-11:00","11:00-12:00",
  "12:00-13:00","13:00-14:00","14:00-15:00","15:00-16:00","16:00-17:00"
];

const timeslotContainer = document.getElementById("timeslots");
const teacherInput = document.getElementById("teacherInput");
const classSelect = document.getElementById("classSelect");
const studentClassSelect = document.getElementById("studentClassSelect");
const saveBtn = document.getElementById("saveBtn");
const updateBtn = document.getElementById("updateBtn");
const clearBtn = document.getElementById("clearBtn");
const availabilityList = document.getElementById("availabilityList");
const editingInfo = document.getElementById("editingInfo");
const studentSlots = document.getElementById("studentSlots");

let selectedSlots = new Set();
let availabilities = [];
let editingId = null;

// RENDER TEACHER TIME SLOTS
function renderTimeSlots() {
  timeslotContainer.innerHTML = '';
  timeSlots.forEach(slot => {
    const d = document.createElement('div');
    d.className = 'slot';
    d.textContent = slot;
    d.dataset.slot = slot;
    d.addEventListener('click', () => {
      if (selectedSlots.has(slot)) {
        selectedSlots.delete(slot);
        d.classList.remove('selected');
      } else {
        selectedSlots.add(slot);
        d.classList.add('selected');
      }
    });
    timeslotContainer.appendChild(d);
  });
}

// FETCH FROM SERVER
async function fetchAvailabilities() {
  try {
    const res = await fetch(API_BASE);
    availabilities = await res.json();
    renderList();
  } catch (e) {
    console.error('fetch error', e);
  }
}

// RENDER TEACHER LIST
function renderList() {
  availabilityList.innerHTML = '';
  if (!availabilities.length) {
    availabilityList.innerHTML = '<div class="small">No availabilities yet.</div>';
    return;
  }
  availabilities.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<strong>${escapeHtml(item.teacher)}</strong> — 
                      <span class="classCode">${escapeHtml(item.class_code)}</span>
                      <div class="small">${item.slots.join(', ')}</div>`;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => startEdit(item);
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => deleteAvailability(item.id);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    card.appendChild(meta);
    card.appendChild(actions);
    availabilityList.appendChild(card);
  });
}

// ESCAPE HTML
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  );
}

// CREATE AVAILABILITY
async function createAvailability() {
  const teacher = teacherInput.value.trim();
  const classCode = classSelect.value;
  if (!teacher) return alert('Enter teacher name');
  if (!classCode) return alert('Select a class');
  if (selectedSlots.size === 0) return alert('Select at least one slot');

  const payload = { teacher, class_code: classCode, slots: Array.from(selectedSlots) };

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Failed to save');

  teacherInput.value = '';
  classSelect.value = '';
  selectedSlots.clear();
  clearSlotSelection();
  await fetchAvailabilities();
}

// START EDIT
function startEdit(item) {
  editingId = item.id;
  teacherInput.value = item.teacher;
  classSelect.value = item.class_code;
  selectedSlots = new Set(item.slots);
  updateSlotSelection();
  editingInfo.textContent = `Editing ID ${editingId} — update fields then click Update`;
  updateBtn.disabled = false;
  saveBtn.disabled = true;
}

// UPDATE AVAILABILITY
async function updateAvailability() {
  if (!editingId) return;
  const teacher = teacherInput.value.trim();
  const classCode = classSelect.value;
  if (!teacher) return alert('Enter teacher name');
  if (!classCode) return alert('Select a class');
  if (selectedSlots.size === 0) return alert('Select at least one slot');

  const payload = { teacher, class_code: classCode, slots: Array.from(selectedSlots) };

  const res = await fetch(API_BASE + '/' + editingId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Failed to update');

  editingId = null;
  teacherInput.value = '';
  classSelect.value = '';
  selectedSlots.clear();
  clearSlotSelection();
  editingInfo.textContent = '';
  updateBtn.disabled = true;
  saveBtn.disabled = false;
  await fetchAvailabilities();
}

// DELETE
async function deleteAvailability(id) {
  if (!confirm('Delete this entry?')) return;
  const res = await fetch(API_BASE + '/' + id, { method: 'DELETE' });
  if (!res.ok) return alert('Failed to delete');
  await fetchAvailabilities();
}

// CLEAR SLOTS
function clearSlotSelection() {
  document.querySelectorAll('.slot').forEach(el => el.classList.remove('selected'));
}
function updateSlotSelection() {
  document.querySelectorAll('.slot').forEach(el => {
    el.classList.toggle('selected', selectedSlots.has(el.dataset.slot));
  });
}

// STUDENT VIEW
studentClassSelect.addEventListener('change', () => {
  const classCode = studentClassSelect.value;
  studentSlots.innerHTML = '';
  if (!classCode) return;

  const classBookings = availabilities.filter(a => a.class_code === classCode);
  const occupied = new Set(classBookings.flatMap(a => a.slots));

  timeSlots.forEach(slot => {
    const d = document.createElement('div');
    d.className = 'slot';
    d.textContent = slot;
    d.classList.add(occupied.has(slot) ? 'occupied' : 'free');
    studentSlots.appendChild(d);
  });
});

// BUTTON EVENTS
saveBtn.addEventListener('click', createAvailability);
updateBtn.addEventListener('click', updateAvailability);
clearBtn.addEventListener('click', () => {
  selectedSlots.clear();
  clearSlotSelection();
  teacherInput.value = '';
  classSelect.value = '';
  editingId = null;
  editingInfo.textContent = '';
  updateBtn.disabled = true;
  saveBtn.disabled = false;
});

// INIT
renderTimeSlots();
fetchAvailabilities();
