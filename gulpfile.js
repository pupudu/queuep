const gulp = require("gulp");
const babel = require("gulp-babel");

gulp.task("babel", gulp.series(function babelSource() {
    return gulp.src(["src/**/*.js"])
        .pipe(babel())
        .pipe(gulp.dest("dist"));
}));
