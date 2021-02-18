const express = require('express');
const router = express.Router();
const session = require('cookie-session');
const mysql = require('mysql');
const bodyParser = require('body-parser');
require('dotenv').config();

// functions
const connection = mysql.createConnection({
	host     : process.env.DB_HOST,
	user     : process.env.DB_USER,
	password : process.env.DB_PS,
	database : process.env.DB_NAME
});

const auth = (role, max) => {
	if(role >= max){
		return false;
	}else if(role <= max){
		return '/school';
	} else {
		return '/login';
	}
}

// routes 
router.get('/', (req, res) => {
  res.redirect('/teacher/school')
})
router.get('/exams', (req, res) => {
	let r_auth = auth(req.session.role, 2);
	if(r_auth){res.redirect(r_auth);return;}

	connection.query(
		"SELECT `id`, `name` FROM `lessons` WHERE `teacher`=?",
		[req.session.user_id], (error, result, fields) => {
			let classes = result;
			if (error) {
				console.log(error);
				res.send("We got some problem");
			}else if (classes !== []){
				res.redirect("/teacher/exams/"+classes[0].id);
			}else{
				res.render('exams', {
					class_id: req.params.id,
					role: req.session.role,
					classes: [],
					tests: [],
					selected_test: [],
					students: []
				});
			}
		}
	)
})
router.get('/exams/:id/new', (req, res) => {
	let r_auth = auth(req.session.role, 2);
	if(r_auth){res.redirect(r_auth);return;}

	res.render("new_exam", {
		role: req.session.role,
		class_id: req.params.id,
	})
})
router.post('/exams/:id/create', (req, res) => {
	let r_auth = auth(req.session.role, 2);
	if(r_auth){res.redirect(r_auth);return;}

	let title = req.body.name;
	let questions = JSON.stringify(req.body.questions);
	let timout = Number(req.body.timout);
	let datetime = req.body.datetime;
	let class_id = Number(req.params.id);
	if(datetime === null){
		datetime = new Date(new Date().getTime()+1000*60*(timout+1)).toISOString().slice(0, 19).replace('T', ' ');
	}
	console.log(datetime);
	console.log(`class id: ${class_id}, name: ${title}, questions: ${questions} and timout: ${timout}`);
	connection.query("INSERT INTO `tests`(`id_class`, `name`, `time`, `questions`, timout) VALUES(?,?,?,?,?)", [class_id, title, datetime, questions, timout], (error, result, fields) => {
		if(error){console.log(error);}
		res.redirect(`/teacher/exams/${class_id}`);
	})
})
router.get('/exams/:id', (req, res) => {
	let r_auth = auth(req.session.role, 2);
	if(r_auth){res.redirect(r_auth);return;}

	connection.query("SELECT `id`, `name` FROM `lessons` WHERE `teacher`=?", [req.session.user_id], (error, result, fields) => {
		let classes = result;
		connection.query("SELECT * FROM `tests` WHERE `id_class`=?", [req.params.id], (error, result, fields) => {
			let tests = result;
			res.render('exams', {
				class_id: req.params.id,
				role: req.session.role,
				classes: classes,
				tests: tests,
				selected_test: [],
				students: [],
				AVG: 0
			})
		})
	})
})
router.get('/exams/:id/:test', (req, res) => {
	let r_auth = auth(req.session.role, 2);
	if(r_auth){res.redirect(r_auth);return;}

	connection.query("SELECT `id`, `name` FROM `lessons` WHERE `teacher`=?", [req.session.user_id], (error, result, fields) => {
		if(error)console.log(error);
		let classes = result;
		connection.query("SELECT * FROM `tests` WHERE `id_class`=?", [req.params.id], (error, result, fields) => {
			if(error)console.log(error);
			let tests = result;
			let selected_test = []
			let AVG_global = 0;
			let AVG_count = tests.length;
			for (let index = 0; index < tests.length; index++) {
				if(tests[index].id === Number(req.params.test)){
					selected_test = tests[index];
				}
				AVG_global += tests[index].avg;
				if(tests[index].avg === null){
					AVG_count--;
				}
			}
			let AVG = AVG_global/100/AVG_count;
			connection.query("SELECT * FROM `user_lesson` WHERE `id_class`=?", [req.params.id], (error, result, fields) => {
				let users = result;
				connection.query("SELECT * FROM `test_usr` WHERE `id_test`=?", [selected_test.id], (error, result, fields) => {
					if(error){console.log(error);}
					let users_rwn = result;
					let modify_users = [];
					// users is undefiened at all 

					connection.query("SELECT * FROM `users` WHERE `role`=1", [], (result, error, fields) => {
						for (let i = 0; i < users_rwn.length; i++) {
							let iknowmark = false;
							for (let j = 0; j < result.length; j++) {
								if(users_rwn[i].id_user === result[j].id){
									iknowmark = true
									modify_users.push({
										id: result[j].id,
										name: result[j].name,
										mark: users_rwn[index].mark
									})
								}
							}
							if(!iknowmark){
								modify_users.push({
									id: result[0].id,
									name: result[0].name,
									mark: 0
								})
							}
						}
						console.log(modify_users);
						res.render('exams', {
							class_id: req.params.id,
							role: req.session.role,
							classes: classes,
							tests: tests,
							students: modify_users,
							selected_test: selected_test,
							AVG: AVG
						})
					})
				})
			})
		})
	})
})
router.get('/school', (req, res) => {
	let r_auth = auth(req.session.role, 2);
	if(r_auth){res.redirect(r_auth);return;}
	
	let lessons_time = [];

	connection.query('SELECT * FROM `lessons` WHERE `teacher`=?',[req.session.user_id], (error, result, fields) => {
		if(error){console.log(error);}
		let classes = result;
		for (let index = 0; index < classes.length; index++) {
			let trida = classes[index];
			let skipper = false;
			let time_string = trida.time, times = [];
			if(typeof time_string === 'undefined'){
				skipper = true;
			}else if(~time_string.indexOf(".")) {
				times = time_string.split(".");
			}else{
				times = [time_string];
			}
			if(!skipper){
				for (let i = 0; i < times.length; i++) {
					let timer = times[i].split("-");
					lessons_time.push({
						id_class: trida.id,
						name: trida.name,
						day: timer[0].toLowerCase(),
						time: Number(timer[1])
					})
				}
			}
		}
		console.log(lessons_time);
		res.render('school', {
			role: req.session.role,
			title: "MBS - My school",
			lessons_time: lessons_time
		});
	})
})
router.post('/grade/:id/:test', (req, res) => {
	let r_auth = auth(req.session.role, 2);
	if(r_auth){res.redirect(r_auth);return;}

	connection.query("DELETE FROM `test_usr` WHERE `id_test`=?", [req.params.test], (error, result, fields) => {
		if(error){console.log(error);}
		let marks = req.body.marks;
		let all_marks = 0;
		let all_list = marks.length;
		for (let index = 0; index < marks.length; index++) {
			let marks_user = marks[index].split('_');
			connection.query("INSERT INTO `test_usr`(`id_user`, `id_test`, `mark`) VALUES (?, ?, ?)", [Number(marks_user[0]), req.params.test, Number(marks_user[1])], (error, result, fields) => {
				if(error){console.log(error);}
				if (index+1 === marks.length) {
					res.redirect(`/teacher/exams/${req.params.id}/${req.params.test}`);
				}
			})
			all_marks += Number(marks_user[0]);
			if(Number(marks_user[0]) === 0){
				all_list--;
			}
		}
		connection.query("UPDATE `tests` SET `avg`=? WHERE `id`=?", [all_marks/all_list, req.params.test], (error, result, fields) => {
			if(error) console.log(error);
		})
	})
})

// redirect to index controller
router.get('/login', (req, res)=>{
  res.redirect("/login")
})
router.get('/logout', (req, res) => {
  res.redirect('/logout')
})
router.get('/register', (req, res)=>{
  res.redirect("/register")
})

module.exports = router;
