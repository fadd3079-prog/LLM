import { state } from '../store/index.js';

export function initSidebar({ onSelectChat, onNewChat, onDeleteChat, onTogglePin }) {
    const sidebar = document.getElementById('sidebar');
    const btnCollapse = document.getElementById('btn-collapse-sidebar');
    const btnOpen = document.getElementById('btn-open-sidebar') || document.getElementById('btn-mobile-menu');
    const backdrop = document.getElementById('sidebar-backdrop');
    const btnNewChat = document.getElementById('btn-new-chat');

    const closeSidebarMobile = () => {
        sidebar.classList.remove('open');
        backdrop?.classList.remove('active');
    };

    if (btnCollapse) {
        btnCollapse.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebarMobile();
            } else {
                sidebar.classList.add('collapsed');
            }
        });
    }

    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.add('open');
                backdrop?.classList.add('active');
            } else {
                sidebar.classList.remove('collapsed');
            }
        });
    }

    if (backdrop) backdrop.addEventListener('click', closeSidebarMobile);

    if (btnNewChat) {
        btnNewChat.addEventListener('click', () => {
            onNewChat();
            if (window.innerWidth <= 768) closeSidebarMobile();
        });
    }

    renderChats({ onSelectChat, onDeleteChat, onTogglePin });
}

export function renderChats({ onSelectChat, onDeleteChat, onTogglePin }) {
    const pinnedList = document.getElementById('pinned-chats-list') || document.getElementById('pinned-chats');
    const recentList = document.getElementById('chat-history-list') || document.getElementById('recent-chats-list');
    const pinnedSection = document.querySelector('.pinned-section');

    if (!pinnedList || !recentList) return;

    pinnedList.innerHTML = '';
    recentList.innerHTML = '';

    const pinnedChats = state.chats.filter(c => c.pinned);
    const recentChats = state.chats.filter(c => !c.pinned);

    if (pinnedSection) {
        pinnedSection.style.display = pinnedChats.length > 0 ? 'flex' : 'none';
    }

    pinnedChats.forEach(chat => {
        pinnedList.appendChild(createChatItem(chat, { onSelectChat, onDeleteChat, onTogglePin }));
    });

    recentChats.forEach(chat => {
        recentList.appendChild(createChatItem(chat, { onSelectChat, onDeleteChat, onTogglePin }));
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ attrs: { 'stroke-width': '1.5' } });
    }
}

function createChatItem(chat, { onSelectChat, onDeleteChat, onTogglePin }) {
    const item = document.createElement('div');
    item.className = `chat-item ${chat.id === state.currentChatId ? 'active' : ''}`;
    item.dataset.id = chat.id;

    const title = document.createElement('span');
    title.className = 'chat-title';
    title.textContent = chat.title || 'Percakapan';

    const actions = document.createElement('div');
    actions.className = 'chat-item-actions';

    const pinBtn = document.createElement('button');
    pinBtn.className = `chat-item-btn pin-btn ${chat.pinned ? 'pinned' : ''}`;
    pinBtn.title = chat.pinned ? 'Lepas sematan' : 'Sematkan';
    pinBtn.innerHTML = `<i data-lucide="${chat.pinned ? 'pin-off' : 'pin'}"></i>`;
    pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onTogglePin(chat.id);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'chat-item-btn delete-btn';
    deleteBtn.title = 'Hapus';
    deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Hapus percakapan ini?')) {
            onDeleteChat(chat.id);
        }
    });

    actions.appendChild(pinBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(title);
    item.appendChild(actions);

    item.addEventListener('click', () => {
        onSelectChat(chat.id);
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar')?.classList.remove('open');
            document.getElementById('sidebar-backdrop')?.classList.remove('active');
        }
    });

    return item;
}

export function updateHeaderModelDisplay() {
    const display = document.getElementById('active-model-display');
    if (!display) return;
    if (state.selectedModel) {
        const found = state.models.find(m => m.id === state.selectedModel);
        display.textContent = found?.name || state.selectedModel;
    } else {
        display.textContent = '';
    }
}