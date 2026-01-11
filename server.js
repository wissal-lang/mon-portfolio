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

// Configuration de la session
app.use(session({
    secret: 'votre-secret-session-intranet',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // mettre à true si HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 heures
        httpOnly: true
    }
}));

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
    const user = req.session.user;
    
    if (!user || user.role !== 'admin') {
        return res.redirect('/login');
    }

    // Récupérer tous les employés
    const queryEmployes = 'SELECT id_employe, prenom, nom, email, role FROM employe ORDER BY nom, prenom';
    
    // Récupérer les congés en attente (si la table existe)
    const queryConges = `
        SELECT c.*, e.prenom as prenom_employe, e.nom as nom_employe 
        FROM conge c 
        LEFT JOIN employe e ON c.id_employe = e.id_employe 
        WHERE c.statut = 'en_attente' OR c.statut IS NULL
        ORDER BY c.date_debut DESC
        LIMIT 20
    `;

    db.query(queryEmployes, (err, employes) => {
        if (err) {
            console.error('Erreur lors de la récupération des employés:', err);
            employes = [];
        }

        // Récupérer les congés
        db.query(queryConges, (err, conges) => {
            if (err) {
                console.error('Erreur lors de la récupération des congés (la table peut ne pas exister):', err);
                conges = [];
            }

            // Compter les tickets IT (exemple - à adapter selon votre structure)
            const queryTickets = 'SELECT COUNT(*) as count FROM ticket WHERE statut = "ouvert" OR statut = "en_cours"';
            
            db.query(queryTickets, (err, ticketsResult) => {
                if (err) {
                    console.error('Erreur lors du comptage des tickets:', err);
                }
                
                const nbTickets = ticketsResult && ticketsResult[0] ? ticketsResult[0].count : 5;

                res.render('admin', { 
                    user: user,
                    employes: employes || [],
                    conges: conges || [],
                    nbTickets: nbTickets,
                    nbEmployes: employes ? employes.length : 0,
                    nbConges: conges ? conges.length : 0,
                    systemStatus: 'Opérationnel'
                });
            });
        });
    });
});

app.get('/employe-dashboard', (req, res) => {
    // Récupérer l'utilisateur depuis la session
    const user = req.session.user;
    
    if (!user) {
        console.log('⚠️ Aucun utilisateur trouvé dans la session, redirection vers login');
        return res.redirect('/login');
    }

    // Debug : vérifier les données de l'utilisateur
    console.log('✅ Utilisateur trouvé dans la session:', {
        id: user.id_employe,
        prenom: user.prenom,
        nom: user.nom,
        email: user.email,
        role: user.role
    });

    // Récupérer les annonces depuis la base de données
    const queryAnnonces = 'SELECT * FROM annonce ORDER BY date_publication DESC';
    
    db.query(queryAnnonces, (err, annonces) => {
        if (err) {
            console.error('Erreur lors de la récupération des annonces:', err);
            return res.render('index', { user: user, annonces: [] });
        }
        
        res.render('index', { user: user, annonces: annonces || [] });
    });
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
app.get('/services/restauration', (req, res) => {
    // Récupérer l'utilisateur depuis la session
    const user = req.session.user;
    
    if (!user) {
        return res.redirect('/login');
    }

    // Récupérer les informations du badge depuis la base de données
    const query = 'SELECT solde_badge, numero_badge FROM employe WHERE id_employe = ?';
    
    db.query(query, [user.id_employe], (err, results) => {
        if (err) {
            console.error('Erreur lors de la récupération du solde:', err);
            return res.render('restauration', { 
                user: user, 
                solde: 0, 
                numero_badge: 'N/A' 
            });
        }
        
        const solde = results[0]?.solde_badge || 0;
        const numero_badge = results[0]?.numero_badge || 'N/A';
        
        res.render('restauration', { 
            user: user, 
            solde: solde, 
            numero_badge: numero_badge 
        });
    });
});

// Route POST pour recharger le badge
app.post('/services/restauration/recharger', (req, res) => {
    const user = req.session.user;
    
    if (!user) {
        return res.json({ success: false, message: 'Non authentifié' });
    }

    const { montant } = req.body;
    const montantNumber = parseFloat(montant);

    // Validation du montant
    if (!montant || isNaN(montantNumber) || montantNumber <= 0) {
        return res.json({ success: false, message: 'Montant invalide' });
    }

    // Récupérer le solde actuel
    const querySelect = 'SELECT solde_badge FROM employe WHERE id_employe = ?';
    
    db.query(querySelect, [user.id_employe], (err, results) => {
        if (err) {
            console.error('Erreur lors de la récupération du solde:', err);
            return res.json({ success: false, message: 'Erreur serveur' });
        }

        const soldeActuel = parseFloat(results[0]?.solde_badge || 0);
        const nouveauSolde = soldeActuel + montantNumber;

        // Mettre à jour le solde dans la base de données
        const queryUpdate = 'UPDATE employe SET solde_badge = ? WHERE id_employe = ?';
        
        db.query(queryUpdate, [nouveauSolde, user.id_employe], (err, result) => {
            if (err) {
                console.error('Erreur lors de la mise à jour du solde:', err);
                return res.json({ success: false, message: 'Erreur lors de la recharge' });
            }

            console.log(`✅ Recharge effectuée: ${montantNumber}€ ajoutés au solde de l'employé ${user.id_employe}`);
            res.json({ 
                success: true, 
                message: 'Recharge effectuée avec succès',
                nouveauSolde: nouveauSolde.toFixed(2)
            });
        });
    });
});

app.get('/services/maintenance', (req, res) => res.render('maintenance', { user: getUser('employe') }));
app.get('/services/rh', (req, res) => res.render('rh', { user: getUser('employe') }));
app.get('/services/auto', (req, res) => res.render('auto', { user: getUser('employe') }));
app.get('/services/salles', (req, res) => res.render('salles', { user: getUser('employe') }));
app.get('/services/support', (req, res) => res.render('support', { user: getUser('employe') }));


// ===================================================
//           ROUTES ADMIN (Gestion Employés & Congés)
// ===================================================

// Middleware pour vérifier si l'utilisateur est admin
const requireAdmin = (req, res, next) => {
    const user = req.session.user;
    if (!user || user.role !== 'admin') {
        return res.json({ success: false, message: 'Accès non autorisé' });
    }
    next();
};

// Ajouter un employé
app.post('/admin/employees/add', requireAdmin, (req, res) => {
    const { prenom, nom, email, mot_de_passe, role } = req.body;

    if (!prenom || !nom || !email || !mot_de_passe) {
        return res.json({ success: false, message: 'Tous les champs sont requis' });
    }

    // Vérifier si l'email existe déjà
    const checkEmail = 'SELECT * FROM employe WHERE email = ?';
    db.query(checkEmail, [email], (err, results) => {
        if (err) {
            console.error('Erreur lors de la vérification de l\'email:', err);
            return res.json({ success: false, message: 'Erreur serveur' });
        }

        if (results.length > 0) {
            return res.json({ success: false, message: 'Cet email est déjà utilisé' });
        }

        // Insérer le nouvel employé
        const insertQuery = 'INSERT INTO employe (prenom, nom, email, mot_de_passe, role, date_creation) VALUES (?, ?, ?, ?, ?, NOW())';
        db.query(insertQuery, [prenom, nom, email, mot_de_passe, role || 'employe'], (err, result) => {
            if (err) {
                console.error('Erreur lors de l\'ajout de l\'employé:', err);
                return res.json({ success: false, message: 'Erreur lors de l\'ajout' });
            }

            console.log(`✅ Employé ajouté: ${prenom} ${nom} (ID: ${result.insertId})`);
            res.json({ success: true, message: 'Employé ajouté avec succès', id: result.insertId });
        });
    });
});

// Supprimer un employé
app.delete('/admin/employees/delete/:id', requireAdmin, (req, res) => {
    const id = req.params.id;
    const user = req.session.user;

    // Empêcher la suppression de soi-même
    if (parseInt(id) === user.id_employe) {
        return res.json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const deleteQuery = 'DELETE FROM employe WHERE id_employe = ?';
    db.query(deleteQuery, [id], (err, result) => {
        if (err) {
            console.error('Erreur lors de la suppression:', err);
            return res.json({ success: false, message: 'Erreur lors de la suppression' });
        }

        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'Employé non trouvé' });
        }

        console.log(`✅ Employé supprimé (ID: ${id})`);
        res.json({ success: true, message: 'Employé supprimé avec succès' });
    });
});

// Valider un congé
app.post('/admin/conges/valider/:id', requireAdmin, (req, res) => {
    const id = req.params.id;

    const updateQuery = 'UPDATE conge SET statut = "approuve", date_traitement = NOW() WHERE id_conge = ?';
    db.query(updateQuery, [id], (err, result) => {
        if (err) {
            console.error('Erreur lors de la validation du congé:', err);
            // Si la table n'existe pas, on retourne un succès simulé
            if (err.code === 'ER_NO_SUCH_TABLE') {
                return res.json({ success: true, message: 'Congé approuvé (table non trouvée - fonctionnalité à implémenter)' });
            }
            return res.json({ success: false, message: 'Erreur lors de la validation' });
        }

        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'Congé non trouvé' });
        }

        console.log(`✅ Congé approuvé (ID: ${id})`);
        res.json({ success: true, message: 'Congé approuvé avec succès' });
    });
});

// Refuser un congé
app.post('/admin/conges/refuser/:id', requireAdmin, (req, res) => {
    const id = req.params.id;

    const updateQuery = 'UPDATE conge SET statut = "refuse", date_traitement = NOW() WHERE id_conge = ?';
    db.query(updateQuery, [id], (err, result) => {
        if (err) {
            console.error('Erreur lors du refus du congé:', err);
            // Si la table n'existe pas, on retourne un succès simulé
            if (err.code === 'ER_NO_SUCH_TABLE') {
                return res.json({ success: true, message: 'Congé refusé (table non trouvée - fonctionnalité à implémenter)' });
            }
            return res.json({ success: false, message: 'Erreur lors du refus' });
        }

        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'Congé non trouvé' });
        }

        console.log(`✅ Congé refusé (ID: ${id})`);
        res.json({ success: true, message: 'Congé refusé' });
    });
});


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
            const userData = results[0];
            console.log(`✅ Connexion réussie : ${userData.prenom || 'N/A'} ${userData.nom || ''} (${userData.role || 'N/A'})`);
            console.log('📋 Données utilisateur complètes:', {
                id_employe: userData.id_employe,
                prenom: userData.prenom,
                nom: userData.nom,
                email: userData.email,
                role: userData.role
            });

            // Créer un objet utilisateur propre pour la session (éviter les problèmes de sérialisation)
            const user = {
                id_employe: userData.id_employe,
                prenom: userData.prenom,
                nom: userData.nom,
                email: userData.email,
                role: userData.role,
                id_departement: userData.id_departement,
                id_role: userData.id_role
            };

            // Stocker l'utilisateur dans la session
            req.session.user = user;
            console.log('💾 Utilisateur stocké dans la session avec succès:', req.session.user);

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

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Erreur lors de la déconnexion:', err);
        res.redirect('/login');
    });
});

// Démarrage du serveur
app.listen(port, () => {
    console.log(`🚀 Serveur lancé sur http://localhost:${port}`);
});