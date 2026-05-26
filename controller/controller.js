const fs = require('fs/promises');
const path = require('path');
const sql = require('mssql');

const DASHBOARD_BUTTON_KEYS = [
	'btnmanageaccess',
	'btnschedules',
	'btnlogs',
	'btndbconfig',
	'btnpermission',
	'btnnewuser',
	'btnimport',
	'btnexport',
];

let sharedPool;

function getDbConfig() {
	const dbPort = Number(process.env.DB_PORT || 1433);

	return {
		server: process.env.DB_SERVER || 'localhost',
		port: Number.isNaN(dbPort) ? 1433 : dbPort,
		user: process.env.DB_USER || 'sa',
		password: process.env.DB_PASSWORD || 'Ch33s3burg3r!',
		database: process.env.DB_NAME || 'barangayworks',
		options: {
			encrypt: true,
			trustServerCertificate: true,
		},
		pool: {
			max: 10,
			min: 0,
			idleTimeoutMillis: 30000,
		},
	};
}

async function getPool() {
	if (sharedPool) return sharedPool;
	sharedPool = await sql.connect(getDbConfig());
	return sharedPool;
}

async function closePool() {
	if (!sharedPool) return;
	await sharedPool.close();
	sharedPool = null;
}

async function runAdminHierarchySeed() {
	const seedFilePath = path.join(__dirname, 'adminhierarchydb');
	const script = await fs.readFile(seedFilePath, 'utf8');
	const pool = await getPool();
	await pool.request().batch(script);
}

async function getAdminPermissions(username) {
	const pool = await getPool();
	const result = await pool
		.request()
		.input('username', sql.NVarChar(100), username)
		.query(`
			SELECT TOP 1
				u.username,
				u.display_name,
				u.is_active,
				r.role_name,
				p.can_click_btnmanageaccess,
				p.can_click_btnschedules,
				p.can_click_btnlogs,
				p.can_click_btndbconfig,
				p.can_click_btnpermission,
				p.can_click_btnnewuser,
				p.can_click_btnimport,
				p.can_click_btnexport
			FROM dbo.admin_users u
			JOIN dbo.admin_roles r ON r.id = u.role_id
			LEFT JOIN dbo.admin_role_permissions p ON p.role_id = r.id
			WHERE u.username = @username
		`);

	const row = result.recordset[0];
	if (!row) return null;

	const permissions = {
		btnmanageaccess: !!row.can_click_btnmanageaccess,
		btnschedules: !!row.can_click_btnschedules,
		btnlogs: !!row.can_click_btnlogs,
		btndbconfig: !!row.can_click_btndbconfig,
		btnpermission: !!row.can_click_btnpermission,
		btnnewuser: !!row.can_click_btnnewuser,
		btnimport: !!row.can_click_btnimport,
		btnexport: !!row.can_click_btnexport,
	};

	return {
		username: row.username,
		displayName: row.display_name,
		role: row.role_name,
		isActive: !!row.is_active,
		permissions,
	};
}

async function canAdminClickButton(username, buttonKey) {
	if (!DASHBOARD_BUTTON_KEYS.includes(buttonKey)) {
		return {
			allowed: false,
			reason: `Unknown button key: ${buttonKey}`,
		};
	}

	const admin = await getAdminPermissions(username);
	if (!admin) {
		return {
			allowed: false,
			reason: 'Admin not found',
		};
	}

	if (!admin.isActive) {
		return {
			allowed: false,
			reason: 'Admin is inactive',
		};
	}

	return {
		allowed: !!admin.permissions[buttonKey],
		reason: !!admin.permissions[buttonKey] ? 'Allowed' : 'Permission denied',
	};
}

async function authenticateAdmin(username, password) {
	if (!username || !password) {
		return {
			ok: false,
			error: 'Username and password are required',
		};
	}

	const pool = await getPool();
	const result = await pool
		.request()
		.input('username', sql.NVarChar(100), username)
		.input('password', sql.NVarChar(255), password)
		.query(`
			SELECT TOP 1
				u.username,
				u.display_name,
				u.is_active,
				r.role_name
			FROM dbo.admin_users u
			JOIN dbo.admin_roles r ON r.id = u.role_id
			WHERE u.username = @username
			  AND u.password_plaintext = @password
		`);

	const row = result.recordset[0];
	if (!row) {
		return {
			ok: false,
			error: 'Invalid username or password',
		};
	}

	if (!row.is_active) {
		return {
			ok: false,
			error: 'Admin account is inactive',
		};
	}

	const profile = await getAdminPermissions(username);
	return {
		ok: true,
		admin: profile,
	};
}

async function ensureSupervisorAutonomy() {
	await runAdminHierarchySeed();
	return getAdminPermissions('supervisor');
}

// Optional route registration if you are using Express.
function registerAdminRoutes(app) {
	if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
		throw new Error('registerAdminRoutes(app) requires an Express app instance');
	}

	app.post('/api/admin/init-hierarchy', async (_req, res) => {
		try {
			const supervisor = await ensureSupervisorAutonomy();
			res.json({ ok: true, supervisor });
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	app.get('/api/admin/:username/permissions', async (req, res) => {
		try {
			const data = await getAdminPermissions(req.params.username);
			if (!data) {
				res.status(404).json({ ok: false, error: 'Admin not found' });
				return;
			}
			res.json({ ok: true, admin: data });
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	app.get('/api/admin/:username/can-click/:buttonKey', async (req, res) => {
		try {
			const result = await canAdminClickButton(req.params.username, req.params.buttonKey);
			res.json({ ok: true, ...result });
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	app.post('/api/admin/login', async (req, res) => {
		try {
			const username = req.body && req.body.username ? String(req.body.username).trim() : '';
			const password = req.body && req.body.password ? String(req.body.password) : '';

			const result = await authenticateAdmin(username, password);
			if (!result.ok) {
				res.status(401).json(result);
				return;
			}

			res.json(result);
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});
}

module.exports = {
	DASHBOARD_BUTTON_KEYS,
	getDbConfig,
	getPool,
	closePool,
	runAdminHierarchySeed,
	ensureSupervisorAutonomy,
	getAdminPermissions,
	canAdminClickButton,
	authenticateAdmin,
	registerAdminRoutes,
};
