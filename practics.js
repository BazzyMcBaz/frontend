
Notification.requestPermission().then(permission => {
  if (permission !== 'granted') alert('Enable notifications for reminders to work!');
});


const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekGrid = document.getElementById('weekGrid');
const addTaskForm = document.getElementById('addTaskForm');
const showFormBtn = document.getElementById('showFormBtn');
const closeFormBtn = document.getElementById('closeFormBtn');
const taskDay = document.getElementById('taskDay');
const taskName = document.getElementById('taskName');
const taskTime = document.getElementById('taskTime');

// Store tasks as an array of arrays
const tasks = [[], [], [], [], [], [], []];

function renderWeek() {
  weekGrid.innerHTML = '';
  weekDays.forEach((day, i) => {
    const card = document.createElement('div');
    card.className = 'day-card';
    card.innerHTML = `<div class="day-title">${day}</div>`;
    if (tasks[i].length === 0) {
      card.innerHTML += `<div class="empty-msg">No tasks yet 🙃</div>`;
    } else {
      tasks[i].forEach((task, idx) => {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task';
        taskDiv.innerHTML = `
          <span>${task.name} | <b>Time:</b> ${task.time}</span>
          <span style="color:#b71c1c;cursor:pointer;font-weight:bold;" title="Delete" data-day="${i}" data-idx="${idx}">&times;</span>
        `;
        card.appendChild(taskDiv);
      });
    }
    weekGrid.appendChild(card);
  });

  // Add click event to task for downloads (if any)
  document.querySelectorAll('.task').forEach(task => {
    task.addEventListener('click', () => {
      const filePath = task.dataset.file;
      if (filePath) {
        const link = document.createElement('a');
        link.href = filePath;
        link.download = filePath.split('/').pop();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('The Solution PDF will be uploaded soon!');
      }
    });
  });

  // ✅ Add delete event listeners
  document.querySelectorAll('.task span[title="Delete"]').forEach(span => {
    span.onclick = async function () {
      const dayIdx = Number(span.getAttribute('data-day'));
      const taskIdx = Number(span.getAttribute('data-idx'));
      const task = tasks[dayIdx][taskIdx];

      // Remove from DB
      if (task.id) {
        try {
          const res = await fetch(`https://task-backend-g375.onrender.com/${task.id}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (!data.success) {
            alert('Failed to delete task from DB.');
          }
        } catch (err) {
          console.error('Error deleting task from DB:', err);
          alert('Server error while deleting task.');
        }
      }

      // Remove from UI
      tasks[dayIdx].splice(taskIdx, 1);
      renderWeek();
    };
  });
}

// Show add task form
showFormBtn.onclick = () => {
  addTaskForm.style.display = 'flex';
};

// Hide add task form
closeFormBtn.onclick = () => {
  addTaskForm.style.display = 'none';
  addTaskForm.reset();
};

// Add new task
addTaskForm.onsubmit = async function (e) {
  e.preventDefault();
  const dayIdx = Number(taskDay.value);
  const taskObj = {
    name: taskName.value,
    time: taskTime.value
  };

  // Add to UI
  tasks[dayIdx].push(taskObj);
  renderWeek();
  addTaskForm.style.display = 'none';
  addTaskForm.reset();

  // Send to backend
  try {
    const res = await fetch('https://task-backend-g375.onrender.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day: dayIdx, ...taskObj })
    });

    const data = await res.json();
    if (!data.success) {
      console.error('Task not saved:', data.message);
      alert('Failed to save task in DB.');
    } else {
      fetchTasksFromDB(); // Refresh tasks from DB (now includes id)
    }
  } catch (err) {
    console.error('Error:', err);
    alert('Error connecting to server.');
  }
};

async function fetchTasksFromDB() {
  try {
    const res = await fetch('https://task-backend-g375.onrender.com');
    const data = await res.json();
    if (data.success) {
      for (let i = 0; i < 7; i++) tasks[i] = [];
      data.tasks.forEach(task => {
        tasks[task.day].push({
          name: task.name,
          time: task.time,
          id: task._id // ✅ store Mongo _id for deletion
        });
      });
      renderWeek();
    } else {
      alert('Failed to load tasks from DB');
    }
  } catch (err) {
    console.error('Error fetching tasks:', err);
    alert('Server error while loading tasks.');
  }
}

// Initial fetch
fetchTasksFromDB();

if ('serviceWorker' in navigator && 'PushManager' in window) {
  navigator.serviceWorker.register('sw.js').then(async swReg => {
    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'PUBLIC_KEY_IN_BASE64'
    });

    // Send to backend
    await fetch('https://task-backend-g375.onrender.com/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: { 'Content-Type': 'application/json' }
    });
  });
}
// Convert VAPID public key to proper format
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

// Request permission and register service worker
if ('serviceWorker' in navigator && 'PushManager' in window) {
  navigator.serviceWorker.register('sw.js').then(async swReg => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Please enable notifications to receive task reminders.');
      return;
    }

    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('YOUR_PUBLIC_VAPID_KEY')
    });

    // Send subscription to backend
    await fetch('https://task-backend-g375.onrender.com/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
  });
}

