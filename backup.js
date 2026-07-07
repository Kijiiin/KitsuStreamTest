// ============================================================
// 🔥 SISTEMA DI BACKUP CENTRALIZZATO
// ============================================================

/**
 * Salva un backup nello storico
 * @param {string} action - Tipo di azione: 'add', 'remove', 'completed', 'move', 'folder_create', 'folder_delete', 'clear', 'import', 'restore', 'manual'
 * @param {string} details - Dettagli dell'azione (es. "Toy Story (Film)")
 * @param {string} source - Da dove viene la modifica: 'index', 'movie', 'tv', 'list'
 * @param {object} currentUser - L'utente corrente
 * @param {Array} currentList - La lista attuale
 * @param {Object} currentFolders - Le cartelle attuali
 */
export async function saveBackup(action, details, source, currentUser, currentList, currentFolders) {
    if (!currentUser) return;

    const totalItems = currentList.length + Object.values(currentFolders).reduce((acc, f) => acc + f.length, 0);
    
    // Mappa le azioni alle descrizioni
    const actionDescriptions = {
        'add': `➕ Aggiunto: ${details}`,
        'remove': `➖ Rimosso: ${details}`,
        'completed': `✅ Completato: ${details}`,
        'uncompleted': `↩️ Da completare: ${details}`,
        'move': `📂 Spostato: ${details}`,
        'folder_create': `📁 Creata cartella: ${details}`,
        'folder_delete': `🗑 Eliminata cartella: ${details}`,
        'clear': `🗑 Svuotata ${details}`,
        'import': `📥 Importazione: ${details}`,
        'restore': `⏪ Ripristino: ${details}`,
        'manual': `💾 Backup manuale`,
        'unknown': `🔄 Modifica generica`
    };
    
    const description = actionDescriptions[action] || actionDescriptions['unknown'];
    const sourceLabel = {
        'index': '🏠 Home',
        'movie': '🎬 Dettaglio Film',
        'tv': '📺 Dettaglio Serie',
        'list': '📋 Lista'
    }[source] || '📋 Sconosciuto';

    const backupData = {
        user: {
            uid: currentUser.uid,
            email: currentUser.email,
            username: currentUser.displayName || currentUser.email?.split('@')[0] || 'Utente'
        },
        list: JSON.parse(JSON.stringify(currentList)),
        folders: JSON.parse(JSON.stringify(currentFolders)),
        exportedAt: new Date().toISOString(),
        totalItems: totalItems,
        version: Date.now(),
        type: "auto_backup",
        action: action,
        description: `${description} (da ${sourceLabel})`,
        source: source,
        details: details
    };

    // Salva nello storico (per utente)
    const historyKey = `kitsustream_backup_history_${currentUser.uid}`;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    
    history.unshift(backupData);
    
    // Mantieni solo gli ultimi 50 backup
    while (history.length > 50) {
        history.pop();
    }
    
    localStorage.setItem(historyKey, JSON.stringify(history));
    
    // Salva anche come ultimo backup
    localStorage.setItem(`kitsustream_last_backup_${currentUser.uid}`, JSON.stringify(backupData));
    
    console.log(`📦 Backup salvato: ${description} (da ${sourceLabel}) - ${totalItems} elementi`);
}

/**
 * Carica lo storico dei backup per un utente
 */
export function loadBackupHistory(userId) {
    if (!userId) return [];
    const historyKey = `kitsustream_backup_history_${userId}`;
    return JSON.parse(localStorage.getItem(historyKey) || '[]');
}

/**
 * Scarica un backup specifico
 */
export function downloadBackup(userId, index) {
    const history = loadBackupHistory(userId);
    if (index < 0 || index >= history.length) {
        alert("❌ Backup non trovato!");
        return;
    }
    
    const data = history[index];
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date(data.exportedAt).toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `backup_${dateStr}_v${data.version}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Ripristina un backup specifico
 */
export function restoreBackup(userId, index, onRestore) {
    const history = loadBackupHistory(userId);
    if (index < 0 || index >= history.length) {
        alert("❌ Backup non trovato!");
        return;
    }
    
    const data = history[index];
    
    if (!data.list || !Array.isArray(data.list)) {
        alert("❌ Backup corrotto!");
        return;
    }

    const confirmMsg = `📋 Ripristinare il backup del ${formatFullDate(data.exportedAt)}?\n\n` +
                      `📝 ${data.description || 'Nessuna descrizione'}\n` +
                      `📦 Elementi nel backup: ${data.totalItems}\n` +
                      `⚠️ Questo SOSTITUIRÀ COMPLETAMENTE la lista attuale!\n\n` +
                      `Procedere?`;
    
    if (!confirm(confirmMsg)) return;
    
    if (onRestore && typeof onRestore === 'function') {
        onRestore(data.list, data.folders);
    }
}

/**
 * Elimina un backup dallo storico
 */
export function deleteBackup(userId, index) {
    if (!userId) return;
    const historyKey = `kitsustream_backup_history_${userId}`;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    
    if (index < 0 || index >= history.length) return;
    
    if (!confirm(`Eliminare il backup del ${formatFullDate(history[index].exportedAt)}?`)) return;
    
    history.splice(index, 1);
    localStorage.setItem(historyKey, JSON.stringify(history));
}

/**
 * Formatta una data con orario
 */
function formatFullDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const options = { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };
        return date.toLocaleDateString('it-IT', options);
    } catch (e) {
        return dateString;
    }
}
