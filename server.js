const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session');
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
    
    // Récupérer les congés en attente pour le compteur
    const queryCongesEnAttente = `
        SELECT COUNT(*) as count 
        FROM conge 
        WHERE statut = 'en_attente' OR statut IS NULL
    `;
    
    // Récupérer tous les congés pour la section Validations
    const queryConges = `
        SELECT c.*, e.prenom as prenom_employe, e.nom as nom_employe 
        FROM conge c 
        LEFT JOIN employe e ON c.id_employe = e.id_employe 
        ORDER BY COALESCE(c.date_demande, c.date_debut) DESC, c.id_conge DESC
        LIMIT 50
    `;

    db.query(queryEmployes, (err, employes) => {
        if (err) {
            console.error('Erreur lors de la récupération des employés:', err);
            employes = [];
        }

        // Récupérer tous les congés pour la section Validations
        db.query(queryConges, (err, conges) => {
            if (err) {
                console.error('❌ Erreur lors de la récupération des congés:', err);
                conges = [];
            } else {
                console.log(`✅ ${conges.length} congé(s) récupéré(s) pour l'admin`);
            }

            // Compter les congés en attente pour le dashboard
            db.query(queryCongesEnAttente, (err, congesEnAttenteResult) => {
                const nbCongesEnAttente = congesEnAttenteResult && congesEnAttenteResult[0] ? congesEnAttenteResult[0].count : 0;

                res.render('admin', { 
                    user: user,
                    employes: employes || [],
                    conges: conges || [],
                    nbConges: nbCongesEnAttente
                });
            });
        });
    });
});

app.get('/employe-dashboard', (req, res) => {
    const user = req.session.user;
    
    if (!user) {
        console.log('⚠️ Aucun utilisateur trouvé dans la session, redirection vers login');
        return res.redirect('/login');
    }

    console.log('✅ Utilisateur trouvé dans la session:', {
        id: user.id_employe,
        prenom: user.prenom,
        nom: user.nom,
        role: user.role
    });

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
app.get('/services', (req, res) => res.render('services', { user: getUser('employe') }));
app.get('/documents', (req, res) => res.render('documents', { user: getUser('employe') }));
app.get('/departements', (req, res) => res.render('departements', { user: getUser('employe') }));
app.get('/applications', (req, res) => res.render('applications', { user: getUser('employe') }));
app.get('/apropos', (req, res) => res.render('apropos', { user: getUser('employe') }));

// --> SOUS-PAGES DU CATALOGUE SERVICES
app.get('/services/restauration', (req, res) => {
    const user = req.session.user;
    
    if (!user) {
        return res.redirect('/login');
    }

    const query = 'SELECT solde_badge, numero_badge FROM employe WHERE id_employe = ?';
    
    db.query(query, [user.id_employe], (err, results) => {
        if (err) {
            console.error('Erreur lors de la récupération du solde:', err);
            return res.render('restauration', { user: user, solde: 0, numero_badge: 'N/A' });
        }
        
        const solde = results[0]?.solde_badge || 0;
        const numero_badge = results[0]?.numero_badge || 'N/A';
        
        res.render('restauration', { user: user, solde: solde, numero_badge: numero_badge });
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

    if (!montant || isNaN(montantNumber) || montantNumber <= 0) {
        return res.json({ success: false, message: 'Montant invalide' });
    }

    const querySelect = 'SELECT solde_badge FROM employe WHERE id_employe = ?';
    
    db.query(querySelect, [user.id_employe], (err, results) => {
        if (err) {
            console.error('Erreur lors de la récupération du solde:', err);
            return res.json({ success: false, message: 'Erreur serveur' });
        }

        const soldeActuel = parseFloat(results[0]?.solde_badge || 0);
        const nouveauSolde = soldeActuel + montantNumber;

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
app.get('/services/rh', (req, res) => {
    const user = req.session.user;
    if (!user) return res.redirect('/login');
    res.render('rh', { user: user });
});
app.get('/services/auto', (req, res) => res.render('auto', { user: getUser('employe') }));
app.get('/services/salles', (req, res) => res.render('salles', { user: getUser('employe') }));
app.get('/services/support', (req, res) => res.render('support', { user: getUser('employe') }));


// ===================================================
//           ROUTES ADMIN (Gestion Employés & Congés)
// ===================================================

const requireAdmin = (req, res, next) => {
    const user = req.session.user;
    if (!user || user.role !== 'admin') {
        return res.json({ success: false, message: 'Accès non autorisé' });
    }
    next();
};

// --- ROUTE POUR PUBLIER UNE ANNONCE (AJOUTÉE ICI) ---
app.post('/admin/annonces/add', requireAdmin, (req, res) => {
    // On récupère 'titre' et 'message' (les noms exacts de ta table)
    const { titre, message } = req.body;
    const user = req.session.user;

    // Validation simple
    if (!titre || !message) {
        return res.json({ success: false, message: 'Le titre et le message sont requis' });
    }

    // Requête SQL adaptée à TA table : annonce
    // On insère : titre, message, date_publication (NOW()), id_employe
    const query = 'INSERT INTO annonce (titre, message, date_publication, id_employe) VALUES (?, ?, NOW(), ?)';
    
    db.query(query, [titre, message, user.id_employe], (err, result) => {
        if (err) {
            console.error('❌ Erreur ajout annonce:', err);
            // On renvoie l'erreur SQL pour t'aider à débugger si besoin
            return res.json({ success: false, message: 'Erreur SQL: ' + err.sqlMessage });
        }
        
        console.log(`📢 Nouvelle annonce publiée par l'admin ${user.id_employe}`);
        res.json({ success: true, message: 'Annonce publiée avec succès !' });
    });
});
// ----------------------------------------------------

// Ajouter un employé
app.post('/admin/employees/add', requireAdmin, (req, res) => {
    const { prenom, nom, email, mot_de_passe, role } = req.body;

    if (!prenom || !nom || !email || !mot_de_passe) {
        return res.json({ success: false, message: 'Tous les champs sont requis' });
    }

    // 1. Vérifier si l'email existe déjà
    const checkEmail = 'SELECT * FROM employe WHERE email = ?';
    db.query(checkEmail, [email], (err, results) => {
        if (err) {
            console.error('Erreur lors de la vérification de l\'email:', err);
            return res.json({ success: false, message: 'Erreur serveur' });
        }

        if (results.length > 0) {
            return res.json({ success: false, message: 'Cet email est déjà utilisé' });
        }

        // 2. Récupérer le premier département disponible
        const getDepartement = 'SELECT id FROM departement ORDER BY id ASC LIMIT 1';
        db.query(getDepartement, (err, departements) => {
            if (err) {
                console.error('Erreur lors de la récupération du département:', err);
                return res.json({ success: false, message: 'Erreur lors de la récupération des départements' });
            }

            if (!departements || departements.length === 0) {
                return res.json({ success: false, message: 'Aucun département trouvé. Veuillez créer au moins un département avant d\'ajouter un employé.' });
            }

            const id_departement = departements[0].id;

            // --- CORRECTION ICI (Gestion id_role et solde_badge) ---
            const id_role = (role === 'admin') ? 1 : 2;

            const insertQuery = `
                INSERT INTO employe 
                (prenom, nom, email, mot_de_passe, role, id_role, id_departement, solde_badge, date_creation) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())
            `;
            
            db.query(insertQuery, [prenom, nom, email, mot_de_passe, role || 'employe', id_role, id_departement], (err, result) => {
                if (err) {
                    console.error('❌ Erreur lors de l\'ajout de l\'employé:', err);
                    return res.json({ success: false, message: 'Erreur SQL: ' + err.sqlMessage });
                }

                console.log(`✅ Employé ajouté: ${prenom} ${nom} (ID: ${result.insertId}, RoleID: ${id_role})`);
                res.json({ success: true, message: 'Employé ajouté avec succès', id: result.insertId });
            });
        });
    });
});

// Supprimer un employé
app.delete('/admin/employees/delete/:id', requireAdmin, (req, res) => {
    const id = req.params.id;
    const user = req.session.user;

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
    const updateQuery = 'UPDATE conge SET statut = "approuve" WHERE id_conge = ?';
    db.query(updateQuery, [id], (err, result) => {
        if (err) {
            console.error('Erreur lors de la validation du congé:', err);
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
    const updateQuery = 'UPDATE conge SET statut = "refuse" WHERE id_conge = ?';
    db.query(updateQuery, [id], (err, result) => {
        if (err) {
            console.error('Erreur lors du refus du congé:', err);
            return res.json({ success: false, message: 'Erreur lors du refus' });
        }
        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'Congé non trouvé' });
        }
        console.log(`✅ Congé refusé (ID: ${id})`);
        res.json({ success: true, message: 'Congé refusé' });
    });
});

// Soumettre une demande de congé
app.post('/services/rh/demande-conge', (req, res) => {
    const user = req.session.user;
    
    if (!user) {
        return res.json({ success: false, message: 'Non authentifié' });
    }

    const { type, date_debut, date_fin, commentaire } = req.body;

    console.log('📝 Données reçues pour demande de congé:', {
        id_employe: user.id_employe, type: type, date_debut: date_debut, date_fin: date_fin
    });

    if (!type || !date_debut || !date_fin) {
        return res.json({ success: false, message: 'Tous les champs obligatoires doivent être remplis' });
    }

    if (!user.id_employe) {
        return res.json({ success: false, message: 'Erreur d\'authentification: ID employé manquant' });
    }

    const dateDebut = new Date(date_debut);
    const dateFin = new Date(date_fin);
    
    if (dateFin < dateDebut) {
        return res.json({ success: false, message: 'La date de fin doit être postérieure à la date de début' });
    }

    const insertQuery = `
        INSERT INTO conge (id_employe, type, date_debut, date_fin, statut, date_demande) 
        VALUES (?, ?, ?, ?, 'en_attente', NOW())
    `;
    
    db.query(insertQuery, [user.id_employe, type, date_debut, date_fin], (err, result) => {
        if (err) {
            console.error('❌ Erreur lors de l\'insertion de la demande de congé:', err);
            const errorMessage = err.sqlMessage || err.message || 'Erreur lors de l\'enregistrement';
            return res.json({ success: false, message: errorMessage });
        }

        console.log(`✅ Demande de congé créée par l'employé ${user.id_employe} (ID: ${result.insertId})`);
        res.json({ success: true, message: 'Demande de congé envoyée avec succès', id_conge: result.insertId });
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
            console.log(`✅ Connexion réussie : ${userData.email}`);

            const user = {
                id_employe: userData.id_employe,
                prenom: userData.prenom,
                nom: userData.nom,
                email: userData.email,
                role: userData.role,
                id_departement: userData.id_departement,
                id_role: userData.id_role
            };

            req.session.user = user;
            
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
   