const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const sql = require('mssql');
const dotenv = require('dotenv');
const AdmZip = require('adm-zip');
const { parse: parseCsv } = require('csv-parse/sync');
const { sendConfirmationEmail } = require('./mailer');

dotenv.config();

const APP_URL = process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
const API_URI = process.env.API_URI || APP_URL;

// --- Inject API_URI into frontend main.js at startup ---
try {
  const mainJsPath = path.resolve(__dirname, '..', 'main.js');
  const mainJs = require('fs').readFileSync(mainJsPath, 'utf8');
  const placeholder = '__INJECTED_API_BASE__';
  if (mainJs.indexOf(placeholder) !== -1) {
    const jsLiteral = API_URI.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    require('fs').writeFileSync(mainJsPath, mainJs.split(placeholder).join(jsLiteral), 'utf8');
    console.log('[inject] Injected API_URI into main.js');
  }
} catch (_e) {
  // Non-fatal: frontend falls back to ?api_uri= or localStorage
}

const BUILTIN_ADMIN_USERNAME = process.env.BUILTIN_ADMIN_USERNAME || '';
const BUILTIN_ADMIN_PASSWORD = process.env.BUILTIN_ADMIN_PASSWORD || '';

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

function getSessionSecret() {
	return process.env.SESSION_SECRET || '';
}

function createAdminExportToken(admin) {
	const payload = {
		username: admin && admin.username ? String(admin.username) : '',
		exp: Date.now() + 24 * 60 * 60 * 1000,
	};
	const payloadText = JSON.stringify(payload);
	const signature = crypto.createHmac('sha256', getSessionSecret()).update(payloadText).digest('hex');
	return Buffer.from(payloadText, 'utf8').toString('base64url') + '.' + signature;
}

function verifyAdminExportToken(token) {
	if (!token || typeof token !== 'string') return null;
	const dotIndex = token.lastIndexOf('.');
	if (dotIndex <= 0) return null;
	const payloadEncoded = token.slice(0, dotIndex);
	const signature = token.slice(dotIndex + 1);
	let payloadText = '';
	try {
		payloadText = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
	} catch (error) {
		return null;
	}
	const expectedSignature = crypto.createHmac('sha256', getSessionSecret()).update(payloadText).digest('hex');
	if (signature.length !== expectedSignature.length) {
		return null;
	}
	if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
		return null;
	}
	try {
		const payload = JSON.parse(payloadText);
		if (!payload || !payload.username || !payload.exp || Date.now() > Number(payload.exp)) {
			return null;
		}
		return payload;
	} catch (error) {
		return null;
	}
}

function bootstrapAdminSessionFromToken(req) {
	let token = '';
	try {
		const requestUrl = new URL(req.originalUrl || req.url || '', APP_URL);
		token = requestUrl.searchParams.get('auth') || '';
	} catch (error) {
		token = req && req.query && req.query.auth ? String(req.query.auth) : '';
	}
	const tokenPayload = verifyAdminExportToken(token);
	if (!tokenPayload || !tokenPayload.username) {
		return false;
	}

	const admin = {
		username: tokenPayload.username,
		role: 'Supervisor',
		permissions: {
			btnmanageaccess: true,
			btnschedules: true,
			btnlogs: true,
			btndbconfig: true,
			btnpermission: true,
			btnnewuser: true,
			btnimport: true,
			btnexport: true,
		},
	};

	if (!req.session) {
		return false;
	}

	req.session.admin = admin;
	return true;
}

function getDbConfig() {
	const dbPort = Number(process.env.DB_PORT || 1433);

	return {
		server: process.env.DB_SERVER || '127.0.0.1',
		port: Number.isNaN(dbPort) ? 1433 : dbPort,
		user: process.env.DB_USER || '',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_NAME || '',
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

async function ensureDatabaseExists() {
	const config = getDbConfig();
	const masterConfig = { ...config, database: 'master' };
	const masterPool = await sql.connect(masterConfig);

	try {
		const dbName = config.database;
		const checkResult = await masterPool
			.request()
			.query(`SELECT COUNT(*) AS cnt FROM sys.databases WHERE name = '${dbName}'`);

		if (checkResult.recordset[0].cnt === 0) {
			await masterPool.request().query(`CREATE DATABASE [${dbName}]`);
			console.log(`[db] Created database '${dbName}'`);
		}
	} finally {
		masterPool.close();
	}
}

async function getPool() {
	if (sharedPool) return sharedPool;
	await ensureDatabaseExists();
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

async function runProcessesSeed() {
    const seedFilePath = path.join(__dirname, 'processesdb');
    const script = await fs.readFile(seedFilePath, 'utf8');
    const pool = await getPool();
    await pool.request().batch(script);
}

async function runSchedulesSeed() {
	const seedFilePath = path.join(__dirname, 'scheduledb');
	const script = await fs.readFile(seedFilePath, 'utf8');
	const pool = await getPool();
	await pool.request().batch(script);
}

async function cleanupOldDoneProcesses() {
	const pool = await getPool();
	const result = await pool.request().query(`
		DELETE FROM dbo.processes
		WHERE selected_date IS NOT NULL
			AND selected_date <= DATEADD(DAY, -7, CONVERT(date, GETDATE()));
		SELECT @@ROWCOUNT AS deleted;
	`);

	const deleted = result.recordset && result.recordset[0] ? Number(result.recordset[0].deleted || 0) : 0;
	if (deleted > 0) {
		console.log(`[db] auto-deleted ${deleted} done process(es) older than 7 days`);
	}
	return deleted;
}

function formatArchiveDate(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function quoteIdentifier(name) {
	return `[${String(name).replace(/\]/g, ']]')}]`;
}

function csvEscape(value) {
	if (value === null || value === undefined) return '""';
	const text = value instanceof Date ? value.toISOString() : String(value);
	return '"' + text.replace(/"/g, '""').replace(/\r\n|\r|\n/g, '\n') + '"';
}

function rowsToCsv(rows) {
	const list = Array.isArray(rows) ? rows : [];
	if (!list.length) return '';
	const columns = Object.keys(list[0]);
	const header = columns.map(csvEscape).join(',');
	const body = list.map((row) => columns.map((column) => csvEscape(row[column])).join(',')).join('\n');
	return header + '\n' + body + '\n';
}

function normalizeArchiveName(name) {
	return String(name || '').replace(/\\/g, '/').replace(/^.*\//, '');
}

function isZipUpload(fileName, mimeType) {
	return /\.zip$/i.test(fileName || '') || /zip/i.test(mimeType || '');
}

async function getTableColumnMetadata(pool, schemaName, tableName) {
	const result = await pool.request()
		.input('schema_name', sql.NVarChar(128), schemaName)
		.input('table_name', sql.NVarChar(128), tableName)
		.query(`
			SELECT
				c.name AS column_name,
				c.is_identity,
				c.is_computed,
				c.is_nullable,
				c.column_id
			FROM sys.columns c
			JOIN sys.tables t ON t.object_id = c.object_id
			JOIN sys.schemas s ON s.schema_id = t.schema_id
			WHERE s.name = @schema_name
				AND t.name = @table_name
			ORDER BY c.column_id
		`);

	return result.recordset || [];
}

function convertCsvValue(value) {
	if (value === undefined || value === null) return null;
	const text = String(value);
	if (text === '') return null;
	return text;
}

function sqlLiteral(value) {
	const converted = convertCsvValue(value);
	if (converted === null) return 'NULL';
	return `'${String(converted).replace(/'/g, "''")}'`;
}

function buildArchiveExpectation() {
	return {
		'admin_role_permissions.csv': { schema: 'dbo', table: 'admin_role_permissions' },
		'admin_roles.csv': { schema: 'dbo', table: 'admin_roles' },
		'admin_users.csv': { schema: 'dbo', table: 'admin_users' },
		'processes.csv': { schema: 'dbo', table: 'processes' },
		'schedule_unavailable_dates.csv': { schema: 'dbo', table: 'schedule_unavailable_dates' },
	};
}

async function restoreTableFromCsv(pool, archivePath, schemaName, tableName, csvText) {
	if (!String(csvText || '').trim()) {
		return;
	}

	const records = parseCsv(csvText, {
		columns: true,
		skip_empty_lines: true,
		trim: true,
	});

	const columns = await getTableColumnMetadata(pool, schemaName, tableName);
	const identityColumn = columns.find((column) => column.is_identity);
	const insertableColumns = columns.filter((column) => !column.is_computed && column.column_name !== 'serial_number');
	const csvColumns = records.length ? Object.keys(records[0]) : [];
	const columnSet = new Set(csvColumns);
	const requiredColumns = insertableColumns.filter((column) => !column.is_nullable && !column.is_identity && column.column_name !== 'created_at');
	const missingRequired = requiredColumns.filter((column) => !columnSet.has(column.column_name));
	if (missingRequired.length) {
		throw new Error(`Archive ${archivePath} is missing required columns for ${schemaName}.${tableName}: ${missingRequired.map((column) => column.column_name).join(', ')}`);
	}

	const targetColumns = insertableColumns.filter((column) => columnSet.has(column.column_name));
	const needsIdentityInsert = !!identityColumn && targetColumns.some((column) => column.column_name === identityColumn.column_name);

	const statements = [];
	if (needsIdentityInsert) {
		statements.push(`SET IDENTITY_INSERT ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)} ON;`);
	}
	statements.push(`DELETE FROM ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)};`);
	for (const record of records) {
		const columnList = targetColumns.map((column) => quoteIdentifier(column.column_name)).join(', ');
		const valuesList = targetColumns.map((column) => sqlLiteral(record[column.column_name])).join(', ');
		statements.push(`INSERT INTO ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)} (${columnList}) VALUES (${valuesList});`);
	}
	if (needsIdentityInsert) {
		statements.push(`SET IDENTITY_INSERT ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)} OFF;`);
	}

	await pool.request().batch(statements.join('\n'));
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

	await runAdminHierarchySeed();

	if (username === BUILTIN_ADMIN_USERNAME && password === BUILTIN_ADMIN_PASSWORD) {
		const builtinAdmin = await getAdminPermissions(BUILTIN_ADMIN_USERNAME);
		if (builtinAdmin) {
			return {
				ok: true,
				admin: builtinAdmin,
			};
		}
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
	return getAdminPermissions(BUILTIN_ADMIN_USERNAME);
}

async function deleteAdminUser(username) {
	if (!username) {
		return { ok: false, error: 'Username is required' };
	}

	const pool = await getPool();
	const result = await pool
		.request()
		.input('username', sql.NVarChar(100), username)
		.query(`
			DELETE FROM dbo.admin_users
			WHERE username = @username
		`);

	if (result.rowsAffected[0] === 0) {
		return { ok: false, error: `User '${username}' not found` };
	}

	return { ok: true, message: `User '${username}' deleted` };
}

function registerAdminRoutes(app) {
	if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
		throw new Error('registerAdminRoutes(app) requires an Express app instance');
	}

	app.get('/api/admin/users', async (_req, res) => {
		try {
			const pool = await getPool();
			const result = await pool.request().query(`
				SELECT u.username, u.display_name, u.email, u.is_active, r.role_name, ISNULL(u.barangay_id, '') AS barangay_id
				FROM dbo.admin_users u
				JOIN dbo.admin_roles r ON r.id = u.role_id
				ORDER BY u.username
			`);
			res.json({ ok: true, users: result.recordset });
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	app.post('/api/admin/init-hierarchy', async (_req, res) => {
		try {
			const supervisor = await ensureSupervisorAutonomy();
			res.json({ ok: true, supervisor });
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	// Insert a process (form submission)
	app.post('/api/processes', async (req, res) => {
		try {
			const { first_name, last_name, province, city, barangay, street, email, contact, service, selected_date } = req.body || {};
			if (!first_name || !last_name || !service) {
				res.status(400).json({ ok: false, error: 'first_name, last_name and service are required' });
				return;
			}

			const pool = await getPool();
			const insert = await pool
				.request()
				.input('first_name', sql.NVarChar(100), first_name)
				.input('last_name', sql.NVarChar(100), last_name)
				.input('province', sql.NVarChar(100), province || null)
				.input('city', sql.NVarChar(100), city || null)
				.input('barangay', sql.NVarChar(100), barangay || null)
				.input('street', sql.NVarChar(255), street || null)
				.input('email', sql.NVarChar(255), email || null)
				.input('contact', sql.NVarChar(50), contact || null)
				.input('service', sql.NVarChar(150), service)
				.input('selected_date', sql.Date, selected_date || null)
				.query(`
					INSERT INTO dbo.processes (first_name, last_name, province, city, barangay, street, email, contact, service, selected_date)
					VALUES (@first_name, @last_name, @province, @city, @barangay, @street, @email, @contact, @service, @selected_date);
					SELECT SCOPE_IDENTITY() AS id;
				`);

			const id = insert.recordset && insert.recordset[0] && insert.recordset[0].id;
			res.status(201).json({ ok: true, id: id });

			// Fire-and-forget confirmation email (non-blocking)
			if (id && email) {
				try {
					const serialResult = await pool.request()
						.input('id', sql.Int, id)
						.query(`SELECT serial_number FROM dbo.processes WHERE id = @id`);
					const row = serialResult.recordset && serialResult.recordset[0];
					if (row && row.serial_number) {
						sendConfirmationEmail({
							to: email,
							first_name: first_name,
							last_name: last_name,
							service: service,
							selected_date: selected_date,
							serial_number: row.serial_number,
						}).catch(function(err) {
							console.warn('[controller] email send error:', err && err.message);
						});
					}
				} catch (mailErr) {
					console.warn('[controller] failed to fetch serial for email:', mailErr.message);
				}
			}
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	app.get('/api/processes', async (_req, res) => {
		try {
			await cleanupOldDoneProcesses();
			const pool = await getPool();
			const result = await pool.request().query(`
				SELECT TOP (100)
					id,
					first_name,
					last_name,
					province,
					city,
					barangay,
					street,
					email,
					contact,
					service,
					selected_date,
					serial_number,
					created_at
				FROM dbo.processes
				ORDER BY selected_date DESC, id DESC
			`);
			res.json({ ok: true, processes: result.recordset });
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	app.get('/api/processes/search', async (req, res) => {
		try {
			const { email, first_name, last_name } = req.query || {};
			if (!email || !first_name || !last_name) {
				return res.status(400).json({ ok: false, error: 'email, first_name, and last_name are required' });
			}

			const pool = await getPool();
			const result = await pool
				.request()
				.input('email', sql.NVarChar(255), email)
				.input('first_name', sql.NVarChar(100), first_name)
				.input('last_name', sql.NVarChar(100), last_name)
				.query(`
					SELECT
						id,
						first_name,
						last_name,
						province,
						city,
						barangay,
						street,
						email,
						contact,
						service,
						selected_date,
						serial_number,
						created_at
					FROM dbo.processes
					WHERE email = @email
						AND first_name = @first_name
						AND last_name = @last_name
					ORDER BY selected_date DESC, id DESC
				`);

			res.json({ ok: true, processes: result.recordset });
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	app.delete('/api/processes/:id', async (req, res) => {
		try {
			const id = Number(req.params.id);
			if (!Number.isInteger(id) || id <= 0) {
				return res.status(400).json({ ok: false, error: 'Invalid process id' });
			}

			const pool = await getPool();
			const result = await pool.request()
				.input('id', sql.Int, id)
				.query(`
					DELETE FROM dbo.processes
					WHERE id = @id;
					SELECT @@ROWCOUNT AS affected;
				`);

			const affected = result.recordset && result.recordset[0] ? Number(result.recordset[0].affected || 0) : 0;
			if (!affected) {
				return res.status(404).json({ ok: false, error: 'Process not found' });
			}

			res.json({ ok: true, deleted: affected });
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	app.get('/api/schedules', async (_req, res) => {
		try {
			const pool = await getPool();
			const result = await pool.request().query(`
				SELECT schedule_date, is_unavailable
				FROM dbo.schedule_unavailable_dates
				WHERE is_unavailable = 1
				ORDER BY schedule_date ASC
			`);
			res.json({ ok: true, dates: result.recordset });
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	app.get('/api/admin/export-archive', async (req, res) => {
		try {
			const authHeader = String(req.headers.authorization || '');
			const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
			const exportToken = bearerToken || String(req.headers['x-admin-token'] || '').trim();
			const tokenPayload = verifyAdminExportToken(exportToken);
			const sessionUsername = req.session && req.session.admin && req.session.admin.username ? String(req.session.admin.username) : '';
			const username = sessionUsername || (tokenPayload && tokenPayload.username ? tokenPayload.username : '');

			if (!username) {
				res.status(401).json({ ok: false, error: 'Admin session required' });
				return;
			}

			const permissionCheck = await canAdminClickButton(username, 'btnexport');
			if (!permissionCheck.allowed) {
				res.status(403).json({ ok: false, error: permissionCheck.reason || 'Permission denied' });
				return;
			}

			const pool = await getPool();
			const tableResult = await pool.request().query(`
				SELECT TABLE_SCHEMA, TABLE_NAME
				FROM INFORMATION_SCHEMA.TABLES
				WHERE TABLE_TYPE = 'BASE TABLE'
					AND TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
				ORDER BY TABLE_SCHEMA, TABLE_NAME
			`);

			const exportDate = formatArchiveDate();
			const archiveFolder = `barangayArchive-${exportDate}`;
			const archiveFileName = `${archiveFolder}.zip`;

			res.status(200);
			res.setHeader('Content-Type', 'application/zip');
			res.setHeader('Content-Disposition', `attachment; filename="${archiveFileName}"`);

			try {
				const zip = new AdmZip();
				for (const table of tableResult.recordset || []) {
					const schemaName = table.TABLE_SCHEMA;
					const tableName = table.TABLE_NAME;
					const result = await pool.request().query(`SELECT * FROM ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`);
					const csv = rowsToCsv(result.recordset || []);
					const fileBaseName = schemaName === 'dbo' ? tableName : `${schemaName}.${tableName}`;
					zip.addFile(`${archiveFolder}/${fileBaseName}.csv`, Buffer.from(csv || '', 'utf8'));
				}

				const zipBuffer = zip.toBuffer();
				res.status(200);
				res.setHeader('Content-Type', 'application/zip');
				res.setHeader('Content-Disposition', `attachment; filename="${archiveFileName}"`);
				res.send(zipBuffer);
			} catch (archiveErr) {
				console.error('[export] archive error:', archiveErr && archiveErr.message ? archiveErr.message : String(archiveErr));
				if (!res.headersSent) {
					res.status(500).json({ ok: false, error: archiveErr && archiveErr.message ? archiveErr.message : String(archiveErr) });
					return;
				}
				res.destroy(archiveErr);
			}
		} catch (error) {
			console.error('[export] export archive failed:', error.message);
			if (!res.headersSent) {
				res.status(500).json({ ok: false, error: error.message });
				return;
			}
			res.destroy(error);
		}
	});

	app.post('/api/admin/import-archive', express.raw({ type: ['application/zip', 'application/octet-stream'], limit: '50mb' }), async (req, res) => {
		try {
			const authHeader = String(req.headers.authorization || '');
			const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
			const importToken = bearerToken || String(req.headers['x-admin-token'] || '').trim();
			const tokenPayload = verifyAdminExportToken(importToken);
			const sessionUsername = req.session && req.session.admin && req.session.admin.username ? String(req.session.admin.username) : '';
			const username = sessionUsername || (tokenPayload && tokenPayload.username ? tokenPayload.username : '');

			if (!username) {
				res.status(401).json({ ok: false, error: 'Admin session required' });
				return;
			}

			const permissionCheck = await canAdminClickButton(username, 'btnimport');
			if (!permissionCheck.allowed) {
				res.status(403).json({ ok: false, error: permissionCheck.reason || 'Permission denied' });
				return;
			}

			if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
				res.status(400).json({ ok: false, error: 'Zip file is required' });
				return;
			}

			const uploadName = String(req.headers['x-file-name'] || req.headers['x-upload-name'] || 'archive.zip');
			if (!isZipUpload(uploadName, req.headers['content-type'])) {
				res.status(400).json({ ok: false, error: 'Only .zip files are allowed' });
				return;
			}

			const zip = new AdmZip(req.body);
			const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
			const expectedMap = buildArchiveExpectation();
			const expectedNames = Object.keys(expectedMap).sort();
			const actualFiles = entries.map((entry) => normalizeArchiveName(entry.entryName)).filter(Boolean);
			const actualBasenames = actualFiles.map((fileName) => path.posix.basename(fileName)).sort();
			const hasExactSet = expectedNames.length === actualBasenames.length && expectedNames.every((name, index) => name === actualBasenames[index]);
			if (!hasExactSet) {
				res.status(400).json({ ok: false, error: `Zip must contain exactly: ${expectedNames.join(', ')}` });
				return;
			}

			const byBaseName = new Map();
			entries.forEach((entry) => {
				const baseName = path.posix.basename(normalizeArchiveName(entry.entryName));
				if (baseName) byBaseName.set(baseName, entry);
			});

			const pool = await getPool();
			const transaction = new sql.Transaction(pool);
			await transaction.begin();

			try {
				await transaction.request().query(`
					DELETE FROM dbo.admin_role_permissions;
					DELETE FROM dbo.admin_users;
					DELETE FROM dbo.processes;
					DELETE FROM dbo.schedule_unavailable_dates;
					DELETE FROM dbo.admin_roles;
				`);

				const restoreOrder = ['admin_roles.csv', 'admin_users.csv', 'admin_role_permissions.csv', 'processes.csv', 'schedule_unavailable_dates.csv'];
				for (const fileName of restoreOrder) {
					const meta = expectedMap[fileName];
					const entry = byBaseName.get(fileName);
					if (!entry) {
						throw new Error(`Missing required file: ${fileName}`);
					}
					const csvText = entry.getData().toString('utf8');
					await restoreTableFromCsv(transaction, fileName, meta.schema, meta.table, csvText);
				}
				await transaction.commit();
				res.json({ ok: true, message: 'Archive imported successfully' });
			} catch (restoreError) {
				try { await transaction.rollback(); } catch (rollbackError) { console.warn('[import] rollback failed:', rollbackError.message); }
				throw restoreError;
			}
		} catch (error) {
			console.error('[import] import archive failed:', error.message);
			res.status(400).json({ ok: false, error: error.message });
		}
	});

	app.put('/api/schedules', async (req, res) => {
		try {
			const { schedule_date, is_unavailable } = req.body || {};
			if (!schedule_date) {
				res.status(400).json({ ok: false, error: 'schedule_date is required' });
				return;
			}

			const pool = await getPool();
			if (is_unavailable) {
				await pool.request()
					.input('schedule_date', sql.Date, schedule_date)
					.query(`
						MERGE dbo.schedule_unavailable_dates AS target
						USING (SELECT @schedule_date AS schedule_date) AS src
						ON target.schedule_date = src.schedule_date
						WHEN MATCHED THEN UPDATE SET is_unavailable = 1, updated_at = SYSUTCDATETIME()
						WHEN NOT MATCHED THEN INSERT (schedule_date, is_unavailable) VALUES (src.schedule_date, 1);
					`);
			} else {
				await pool.request()
					.input('schedule_date', sql.Date, schedule_date)
					.query(`DELETE FROM dbo.schedule_unavailable_dates WHERE schedule_date = @schedule_date`);
			}

			res.json({ ok: true });
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

	app.delete('/api/admin/user/:username', async (req, res) => {
		try {
			const result = await deleteAdminUser(req.params.username);
			if (!result.ok) {
				res.status(404).json(result);
				return;
			}
			res.json(result);
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	app.patch('/api/admin/user/:username/role', async (req, res) => {
		try {
			const { username } = req.params;
			const { role_name } = req.body || {};
			if (!username || !role_name) {
				res.status(400).json({ ok: false, error: 'username and role_name are required' });
				return;
			}

			const pool = await getPool();

			const roleResult = await pool
				.request()
				.input('role_name', sql.NVarChar(50), role_name)
				.query(`SELECT id FROM dbo.admin_roles WHERE role_name = @role_name`);

			if (!roleResult.recordset[0]) {
				res.status(400).json({ ok: false, error: `Role '${role_name}' not found` });
				return;
			}
			const roleId = roleResult.recordset[0].id;

			const updateResult = await pool
				.request()
				.input('username', sql.NVarChar(100), username)
				.input('role_id', sql.Int, roleId)
				.query(`
					UPDATE dbo.admin_users
					SET role_id = @role_id, updated_at = SYSUTCDATETIME()
					WHERE username = @username
				`);

			if (updateResult.rowsAffected[0] === 0) {
				res.status(404).json({ ok: false, error: `User '${username}' not found` });
				return;
			}

			res.json({ ok: true, message: `User '${username}' role updated to '${role_name}'` });
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	app.put('/api/admin/user', async (req, res) => {
		try {
			const { username, password, display_name, email, role_name, barangay_id } = req.body || {};
			if (!username || !password) {
				res.status(400).json({ ok: false, error: 'username and password are required' });
				return;
			}

			const pool = await getPool();

			// Check for existing username or barangay_id to avoid overwriting
			const existsReq = pool.request().input('username', sql.NVarChar(100), username);
			if (barangay_id) existsReq.input('barangay_id', sql.NVarChar(100), barangay_id);
			const existsQuery = barangay_id
				? `SELECT 1 FROM dbo.admin_users WHERE username = @username OR barangay_id = @barangay_id`
				: `SELECT 1 FROM dbo.admin_users WHERE username = @username`;
			const existsResult = await existsReq.query(existsQuery);
			if (existsResult.recordset && existsResult.recordset.length > 0) {
				res.status(409).json({ ok: false, error: 'username or barangay ID already taken' });
				return;
			}

			const roleResult = await pool
				.request()
				.input('role_name', sql.NVarChar(50), role_name || 'Supervisor')
				.query(`SELECT id FROM dbo.admin_roles WHERE role_name = @role_name`);

			if (!roleResult.recordset[0]) {
				res.status(400).json({ ok: false, error: `Role '${role_name}' not found` });
				return;
			}
			const roleId = roleResult.recordset[0].id;

			// Insert new admin user (do NOT delete existing users)
			await pool
				.request()
				.input('username', sql.NVarChar(100), username)
				.input('password', sql.NVarChar(255), password)
				.input('display_name', sql.NVarChar(120), display_name || username)
				.input('email', sql.NVarChar(255), email || null)
				.input('role_id', sql.Int, roleId)
				.input('barangay_id', sql.NVarChar(100), barangay_id || null)
				.query(`
					INSERT INTO dbo.admin_users (username, password_plaintext, display_name, email, role_id, barangay_id, is_active)
					VALUES (@username, @password, @display_name, @email, @role_id, @barangay_id, 1)
				`);

			res.status(201).json({ ok: true, message: `User '${username}' created` });
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});
}

function createApp() {
	const cors = require('cors');
	const session = require('express-session');

	const app = express();
	const __root = path.resolve(__dirname, '..');

	app.use(cors({
		origin(origin, callback) {
			if (!origin) return callback(null, true);
			return callback(null, true);
		},
		credentials: true,
	}));
	app.use(express.json());

	// Session middleware
	app.use(session({
		secret: getSessionSecret(),
		resave: false,
		saveUninitialized: false,
		cookie: {
			httpOnly: true,
			// Allow the admin UI to work when it is opened from file:// during local development.
			sameSite: 'none',
			secure: false,
			maxAge: 24 * 60 * 60 * 1000,
		},
	}));

	const requireAdminPageAccess = (req, res, next) => {
		if (req.session && req.session.admin) {
			next();
			return;
		}

		if (bootstrapAdminSessionFromToken(req)) {
			next();
			return;
		}

		res.redirect('/adminlogin.html');
	};

	app.get('/admindashboard.html', requireAdminPageAccess, (_req, res) => {
		res.sendFile(path.join(__root, 'admindashboard.html'));
	});

	// Additional admin-only pages
	[
		['/permissions.html', 'permissions.html'],
		['/newadmin.html', 'newadmin.html'],
		['/logs.html', 'logs.html'],
	].forEach(([routePath, fileName]) => {
		app.get(routePath, requireAdminPageAccess, (_req, res) => {
			res.sendFile(path.join(__root, fileName));
		});
	});

	// Serve static files from project root

	// Serve a small runtime config script so frontend can read the API base URL
	app.get('/bw-config.js', (_req, res) => {
		const url = API_URI;
		res.type('application/javascript').send(`window.BW_API_BASE = '${url}';`);
	});

	app.use(express.static(__root, {
		dotfiles: 'ignore',
		index: false,
	}));

	// Admin login (sets session)
	app.post('/api/admin/login', async (req, res) => {
		try {
			const username = req.body && req.body.username ? String(req.body.username).trim() : '';
			const password = req.body && req.body.password ? String(req.body.password) : '';

			const result = await authenticateAdmin(username, password);
			if (!result.ok) {
				res.status(401).json(result);
				return;
			}

			req.session.admin = {
				username: result.admin.username,
				role: result.admin.role,
				permissions: result.admin.permissions,
			};

			res.json({
				...result,
				exportToken: createAdminExportToken(result.admin),
			});
		} catch (error) {
			res.status(500).json({ ok: false, error: error.message });
		}
	});

	// Admin logout
	app.post('/api/admin/logout', (req, res) => {
		req.session.destroy(() => {
			res.json({ ok: true });
		});
	});

	// Check session validity
	app.get('/api/admin/session', (req, res) => {
		if (!req.session.admin) {
			res.json({ ok: false });
			return;
		}
		res.json({ ok: true, admin: req.session.admin });
	});

	// Register all other admin routes
	registerAdminRoutes(app);

	// Health check
	app.get('/health', (_req, res) => {
		res.json({ ok: true, service: 'barangayworks-api' });
	});

	return app;
}

async function startServer() {
	const app = createApp();
	const PORT = Number(process.env.PORT || 3000);

	// Wait for SQL Server to be available, ensure DB exists and run seeds
	async function waitForSqlServer(maxAttempts = 30, delayMs = 2000) {
		const cfg = getDbConfig();
		const masterCfg = { ...cfg, database: 'master' };
		let attempt = 0;
		while (attempt < maxAttempts) {
			try {
				const pool = await sql.connect(masterCfg);
				await pool.close();
				return;
			} catch (err) {
				attempt += 1;
				console.log(`[db] waitForSqlServer attempt ${attempt}/${maxAttempts} failed: ${err && err.message ? err.message : String(err)}`);
				// eslint-disable-next-line no-await-in-loop
				await new Promise((r) => setTimeout(r, delayMs));
			}
		}
		throw new Error('Timed out waiting for SQL Server to become available');
	}

	// Perform initialization before listening so the DB and seeds exist when
	// the server starts accepting requests. If initialization fails, we still
	// start the server but log the problem so the operator can inspect logs.
	(async () => {
		try {
			const attempts = Number(process.env.DB_INIT_RETRIES || 30);
			const delay = Number(process.env.DB_INIT_DELAY_MS || 2000);
			await waitForSqlServer(attempts, delay);
			await ensureDatabaseExists();
			try {
				await ensureSupervisorAutonomy();
			} catch (err) {
				console.warn('[db] ensureSupervisorAutonomy failed:', err && err.message ? err.message : String(err));
			}
			try {
				await runSchedulesSeed();
				console.log('[db] schedules seed applied');
			} catch (err) {
				console.warn('[db] schedules seed failed:', err && err.message ? err.message : String(err));
			}
			try {
				await runProcessesSeed();
				console.log('[db] processes seed applied');
			} catch (err) {
				console.warn('[db] processes seed failed:', err && err.message ? err.message : String(err));
			}
		} catch (initErr) {
			console.error('[api] pre-listen DB initialization failed:', initErr && initErr.message ? initErr.message : String(initErr));
		}

		// Start listening after attempting initialization
		const server = app.listen(PORT, () => {
			console.log(`[api] running on ${APP_URL}`);
		});

		async function shutdown() {
			server.close(async () => {
				try {
					await closePool();
				} catch (error) {
					console.error('[api] pool close error:', error.message);
				}
				process.exit(0);
			});
		}

		process.on('SIGINT', shutdown);
		process.on('SIGTERM', shutdown);
	})();

	// Return a promise-like value: the start process is asynchronous but the
	// exported function resolves immediately with no server handle. Callers
	// that need the server object should call createApp() / listen() directly.
	return null;
}

module.exports = {
	DASHBOARD_BUTTON_KEYS,
	getDbConfig,
	getPool,
	closePool,
	runAdminHierarchySeed,
	runProcessesSeed,
	runSchedulesSeed,
	ensureSupervisorAutonomy,
	getAdminPermissions,
	canAdminClickButton,
	authenticateAdmin,
	deleteAdminUser,
	registerAdminRoutes,
	createApp,
	startServer,
};