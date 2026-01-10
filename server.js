const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session'); // INDISPENSABLE pour garder la connexion
const app = express();
const port = 3001;

// --- 1. CONFIGURATION ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Pour lire les données des formulaires et JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// CONFIGURATION DE LA SESSION (C'est ça qui permet de retenir le nom "Soukaina")
app.use(session({
    secret: 'mon_secret_super_securise_intranet', // Tu peux mettre ce que tu veux ici
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Mettre 'true' seulement si tu es en HTTPS
}));

// --- 2. BASE DE DONNÉES ---
const db = mysql.createConnection({
    host: 'localhost', 
    user: 'root',
    password: 'Quantum_Ridge#91&', 
    database: 'intranet_db'
});

db.connect(err => {
    if(err) console.error('❌ Erreur Connexion BDD:', err);
    else console.log('✅ BDD Connectée avec succès !');
});

// --- 3. MIDDLEWARE DE SÉCURITÉ (Protection des pages) ---
// Si quelqu'un essaie d'aller sur le dashboard sans être connecté, on le renvoie au login
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// ===================================================
//                 ROUTES (NAVIGATION)
// ===================================================

// --> ACCUEIL & LOGIN
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
    // Si déjà connecté, on redirige direct vers le bon dashboard
    if (req.session.user) {
        if (req.session.user.role === 'admin') return res.redirect('/admin-dashboard');
        return res.redirect('/employe-dashboard');
    }
    res.render('login');
});

// --> DASHBOARD EMPLOYÉ (Ton fichier index.html qui est maintenant index.ejs)
app.get('/employe-dashboard', requireLogin, (req, res) => {
    // Ici, req.session.user contient les vraies infos de la BDD (ex: Soukaina)
    
    // NOTE : Pour l'instant je mets des chiffres fictifs pour tickets et congés
    // Plus tard, tu pourras faire des requêtes SQL ici pour avoir les vrais chiffres.
    res.render('index', { 
        user: req.session.user, 
        soldeConges: 18,     // Tu pourras remplacer ça par une requête SQL plus tard
        nbTickets: 2, 
        nbDemandesRH: 1,
        nbNotifs: 3,
        annonces: [] 
    });
});

// --> DASHBOARD ADMIN
app.get('/admin-dashboard', requireLogin, (req, res) => {
    if (req.session.user.role !== 'admin') return res.redirect('/employe-dashboard');
    res.render('admin', { user: req.session.user, nbTickets: 5, systemStatus: 'Opérationnel' });
});

// --> PAGES DU MENU (On utilise requireLogin pour protéger)
// On passe 'req.session.user' pour que le nom s'affiche aussi sur ces pages
app.get('/services', requireLogin, (req, res) => res.render('services', { user: req.session.user }));
app.get('/documents', requireLogin, (req, res) => res.render('documents', { user: req.session.user }));
app.get('/departements', requireLogin, (req, res) => res.render('departements', { user: req.session.user }));
app.get('/applications', requireLogin, (req, res) => res.render('applications', { user: req.session.user }));
app.get('/apropos', requireLogin, (req, res) => res.render('apropos', { user: req.session.user }));

// --> SOUS-PAGES SERVICES
app.get('/services/restauration', requireLogin, (req, res) => res.render('restauration', { user: req.session.user }));
app.get('/services/maintenance', requireLogin, (req, res) => res.render('maintenance', { user: req.session.user }));
app.get('/services/rh', requireLogin, (req, res) => res.render('rh', { user: req.session.user }));
app.get('/services/auto', requireLogin, (req, res) => res.render('auto', { user: req.session.user }));
app.get('/services/salles', requireLogin, (req, res) => res.render('salles', { user: req.session.user }));
app.get('/services/support', requireLogin, (req, res) => res.render('support', { user: req.session.user }));


// ===================================================
//                 LOGIQUE DE CONNEXION
// ===================================================
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    // Requête pour vérifier l'utilisateur
    const query = 'SELECT * FROM employe WHERE email = ? AND mot_de_passe = ?';

    db.query(query, [email, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, message: "Erreur serveur BDD" });
        }

        if (results.length > 0) {
            // L'utilisateur existe !
            const utilisateurTrouve = results[0];
            
            // SUPER IMPORTANT : On sauvegarde l'utilisateur dans la SESSION
            req.session.user = utilisateurTrouve;
            
            console.log(`✅ Connexion réussie : ${utilisateurTrouve.prenom} ${utilisateurTrouve.nom}`);

            // On renvoie la redirection au Front-End (fetch en JS)
            if (utilisateurTrouve.role === 'admin') {
                res.json({ success: true, redirect: '/admin-dashboard' });
            } else {
                res.json({ success: true, redirect: '/employe-dashboard' });
            }
        } else {
            res.json({ success: false, message: "Email ou mot de passe incorrect" });
        }
    });
});

// --> DÉCONNEXION
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return console.log(err);
        res.redirect('/login');
    });
});

// Démarrage du serveur
app.listen(port, () => {
    console.log(`🚀 Serveur lancé sur http://localhost:${port}`);
});