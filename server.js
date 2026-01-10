const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session'); // Optionnel mais recommandé pour la suite
const app = express();
const port = 3001;

// --- 1. CONFIGURATION ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. BASE DE DONNÉES ---
const db = mysql.createConnection({
    host: 'localhost', user: 'root',
    password: 'Quantum_Ridge#91&', // Ton mot de passe exact
    database: 'intranet_db'
});

db.connect(err => {
    if(err) console.error('❌ Erreur Connexion BDD:', err);
    else console.log('✅ BDD Connectée avec succès !');
});

// --- 3. FONCTION UTILITAIRE (Pour éviter les crashs) ---
// Cette fonction permet d'envoyer les infos de l'utilisateur à chaque page
const getUser = (role) => {
    if (role === 'admin') return { prenom: 'Amine', nom: 'Alaoui', role: 'admin' };
    return { prenom: 'Sara', nom: 'Test', role: 'employe' };
};


// ===================================================
//                 ROUTES (NAVIGATION)
// ===================================================

// --> ACCUEIL & LOGIN
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.render('login'));

// --> DASHBOARDS (Tableaux de bord)
app.get('/admin-dashboard', (req, res) => {
    res.render('admin', { user: getUser('admin'), nbTickets: 5, systemStatus: 'Opérationnel' });
});

app.get('/employe-dashboard', (req, res) => {
    res.render('index', { user: getUser('employe'), nbTickets: 3, annonces: [] });
});

// --> PAGES DU MENU (Barre latérale)
// Note: On pointe vers le nom du fichier EJS sans l'extension
app.get('/services', (req, res) => res.render('services', { user: getUser('employe') }));
app.get('/documents', (req, res) => res.render('documents', { user: getUser('employe') }));
app.get('/departements', (req, res) => res.render('departements', { user: getUser('employe') }));
app.get('/applications', (req, res) => res.render('applications', { user: getUser('employe') }));
app.get('/apropos', (req, res) => res.render('apropos', { user: getUser('employe') }));

// --> SOUS-PAGES DU CATALOGUE SERVICES
// Je me base sur ta liste de fichiers dans l'image envoyée
app.get('/services/restauration', (req, res) => res.render('restauration', { user: getUser('employe') }));
app.get('/services/maintenance', (req, res) => res.render('maintenance', { user: getUser('employe') }));
app.get('/services/rh', (req, res) => res.render('rh', { user: getUser('employe') }));
app.get('/services/auto', (req, res) => res.render('auto', { user: getUser('employe') }));
app.get('/services/salles', (req, res) => res.render('salles', { user: getUser('employe') }));
app.get('/services/support', (req, res) => res.render('support', { user: getUser('employe') }));


// ===================================================
//                 LOGIQUE DE CONNEXION
// ===================================================
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    console.log(`Tentative de connexion : ${email}`);

    const query = 'SELECT * FROM employe WHERE email = ? AND mot_de_passe = ?';

    db.query(query, [email, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, message: "Erreur serveur" });
        }

        if (results.length > 0) {
            const user = results[0];
            console.log(`Connexion réussie : ${user.prenom} (${user.role})`);

            // C'est ICI qu'on décide où ils vont
            if (user.role === 'admin') {
                res.json({ success: true, redirect: '/admin-dashboard', user: user });
            } else {
                res.json({ success: true, redirect: '/employe-dashboard', user: user });
            }
        } else {
            res.json({ success: false, message: "Email ou mot de passe incorrect" });
        }
    });
});

app.get('/logout', (req, res) => res.redirect('/login'));

// Démarrage du serveur
app.listen(port, () => {
    console.log(`🚀 Serveur lancé sur http://localhost:${port}`);
});